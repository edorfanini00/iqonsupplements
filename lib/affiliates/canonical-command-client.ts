"use client";

export const COMMAND_KINDS=['signup','affiliate-approval','commission-settings','payout-record','creator-code-sync','admin-create'] as const;
export type CommandKind=typeof COMMAND_KINDS[number];
export type CommandEnvelope={version:1;commandId:string;expectedVersion?:number;payload:Record<string,unknown>};
export type SavedAttempt={kind:CommandKind;envelope:CommandEnvelope;state:string;rejected?:boolean;archived?:boolean;outbox?:Array<{store:string;operation:string;state:string;reason?:string|null}>;createdAt:string};
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Json=Record<string,any>;
export type CommandResponse={ok:boolean;status:number;json:()=>Promise<Json>};
const result=(data:Json,status=0,ok=false):CommandResponse=>({ok,status,json:async()=>data});
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function commandComplete(kind:CommandKind,data:Json):boolean {
 if(data.command?.state!=='committed')return false;
 if(kind==='payout-record')return !!data.payout?.id;
 const tasks=Array.isArray(data.outbox)?data.outbox:[];
 if(kind==='admin-create')return !!data.affiliate?.id&&Array.isArray(data.outbox)&&tasks.every(t=>t.state==='confirmed');
 if(kind==='signup')return tasks.some(t=>t.store==='identity'&&t.operation==='signup'&&t.state==='confirmed');
 return ['woo','shopify'].every(store=>tasks.some(t=>t.store===store&&t.operation==='public-code'&&t.state==='confirmed'));
}
const storageKey=(actor:string)=>`iqon-body:canonical-attempts:v1:${actor}`;
const slot=(kind:CommandKind,payload:Record<string,unknown>)=>`${kind}:${payload.affiliateId??payload.email??'self'}`;

/** Client attempt journal only, never a competing financial ledger. All success
 * and permissions come from fresh canonical receipts. Passwords are never saved.
 * Payload/key are written before dispatch and retained on every ambiguous result. */
export function createCommandClient(options:{storage:StorageLike;fetch:(url:string,init?:RequestInit)=>Promise<Response>;uuid:()=>string;changed?:()=>void}) {
 const read=(actor:string):Record<string,SavedAttempt>=>JSON.parse(options.storage.getItem(storageKey(actor))??'{}');
 const write=(actor:string,records:Record<string,SavedAttempt>)=>{options.storage.setItem(storageKey(actor),JSON.stringify(records));options.changed?.();};
 async function submit(actor:string,kind:CommandKind,payload:Record<string,unknown>,expectedVersion?:number):Promise<CommandResponse>{
  const run=async():Promise<CommandResponse>=>{
   if(!COMMAND_KINDS.includes(kind))return result({error:'Unsupported canonical command'});
   let records:Record<string,SavedAttempt>,saved:SavedAttempt;
   const clean=JSON.parse(JSON.stringify(payload));
   if(kind==='signup')delete clean.password;
   const id=slot(kind,clean);
   try{
    records=read(actor);const existing=records[id];
    if(existing){
     if(canonical(existing.envelope.payload)!==canonical(clean))return result({error:`A saved ${kind} attempt (${existing.envelope.commandId}) needs resolution first. Retry its exact saved payload from Command recovery; do not create a second operation.`,command:existing});
     saved=existing;
    }else{
     saved={kind,envelope:{version:1,commandId:options.uuid(),...(expectedVersion===undefined?{}:{expectedVersion}),payload:clean},state:'unknown',createdAt:new Date().toISOString()};
     records[id]=saved;write(actor,records);
    }
   }catch{return result({error:'Secure attempt storage is unavailable or invalid. Nothing was submitted. Enable site storage before retrying.'});}
   const envelope=kind==='signup'?{...saved.envelope,payload:{...saved.envelope.payload,password:payload.password}}:saved.envelope;
   if(kind==='signup'&&typeof payload.password!=='string')return result({error:'Re-enter your password in the signup form to retry the saved application. It is never stored.'});
   try{
    // Completed attempts require a fresh authorized read; repeated clicks must
    // not silently generate a second identical financial operation.
    const completed=saved.state==='committed'&&(kind==='payout-record'||commandComplete(kind,{command:{state:saved.state},outbox:saved.outbox}));
    const response=await options.fetch(`/api/affiliates/commands/${kind}${completed?'/'+saved.envelope.commandId:''}`,{method:completed?'GET':'POST',credentials:'include',cache:'no-store',headers:completed?undefined:{'Content-Type':'application/json'},body:completed?undefined:JSON.stringify(envelope)});
    const data=await response.json();
    const receipt=data.command;
    const matching=receipt?.id===saved.envelope.commandId&&receipt?.kind===kind;
    if(matching){saved.state=receipt.state;saved.outbox=Array.isArray(data.outbox)?data.outbox:undefined;records=read(actor);records[id]=saved;write(actor,records);}
    // Final Health contract guarantees these errors precede commit. Preserve the
    // rejected receipt locally, but permit a corrected *user* submission with a
    // fresh state/version. Anonymous signup cannot use authenticated status reads.
    // Never release generic CONFLICT, timeout, or an unrecognized response.
    const definitive=!receipt && (response.status===409&&['VERSION_CONFLICT','PROVIDER_BUSY','REJECTED_CONFLICT'].includes((data.errorDetail??data.error)?.code)
      || kind==='signup'&&[400,413,422].includes(response.status)&&(data.errorDetail??data.error)?.code==='VALIDATION_ERROR');
    if(definitive){records=read(actor);if(records[id]?.envelope.commandId===saved.envelope.commandId){records[`archive:${saved.envelope.commandId}`]={...saved,state:'rejected-no-commit',rejected:true,archived:true};delete records[id];write(actor,records);}}
    else if(!matching&&[400,409,413,422].includes(response.status)&&['VALIDATION_ERROR','CONFLICT','VERSION_CONFLICT'].includes((data.errorDetail??data.error)?.code)){saved.rejected=true;records=read(actor);records[id]=saved;write(actor,records);}
    if(response.ok&&matching&&commandComplete(kind,data))return result(data,response.status,true);
    return result({...data,error:matching?`Command ${receipt.state ?? 'pending'} (${saved.envelope.commandId}). Not confirmed complete. Provider work may still be pending or blocked; use Command recovery to check or retry this same attempt.`:typeof data.error==='string'?data.error:typeof data.error?.message==='string'?data.error.message:`Outcome unknown (${saved.envelope.commandId}). Keep and retry this exact saved attempt; no success has been confirmed.`},response.status);
   }catch{return result({error:`Outcome unknown (${saved.envelope.commandId}). The exact attempt is saved. Retry it rather than creating another operation.`});}
  };
  // Serialize tabs for the same actor/operation; authority still enforces receipt
  // uniqueness across portals, browsers and machines.
  const locks=typeof navigator!=='undefined'?navigator.locks:undefined;
  return locks?locks.request(`${storageKey(actor)}:${slot(kind,payload)}`,run):run();
 }
 async function check(actor:string,attempt:SavedAttempt):Promise<CommandResponse>{
  try{
   const response=await options.fetch(`/api/affiliates/commands/${attempt.kind}/${attempt.envelope.commandId}`,{credentials:'include',cache:'no-store'});
   const data=await response.json();
   if(response.ok&&data.command?.id===attempt.envelope.commandId&&data.command?.kind===attempt.kind){const records=read(actor);const id=attempt.archived?`archive:${attempt.envelope.commandId}`:slot(attempt.kind,attempt.envelope.payload);if(records[id]?.envelope.commandId===attempt.envelope.commandId){records[id].state=data.command.state;records[id].outbox=Array.isArray(data.outbox)?data.outbox:undefined;write(actor,records);}return result(data,response.status,commandComplete(attempt.kind,data));}
   return result(data,response.status);
  }catch{return result({error:'Receipt readback unavailable. The attempt is retained.'});}
 }
 return {submit,check,
  allowCorrection:async(actor:string,attempt:SavedAttempt)=>{
   if(attempt.kind==='signup'||!attempt.rejected||attempt.archived)return false;
   const verified=await check(actor,attempt);const data=await verified.json();
   if(verified.status!==404||(data.errorDetail??data.error)?.code!=='VALIDATION_ERROR'||(data.errorDetail??data.error)?.message!=='Command not found')return false;
   const records=read(actor);const id=slot(attempt.kind,attempt.envelope.payload);
   if(records[id]?.envelope.commandId!==attempt.envelope.commandId||!records[id].rejected)return false;
   records[`archive:${attempt.envelope.commandId}`]={...records[id],state:'rejected-no-record',archived:true};delete records[id];write(actor,records);return true;
  },list:(actor:string)=>Object.values(read(actor)),
  // New operation is explicit and only permitted after fresh completion readback.
  finish:async(actor:string,attempt:SavedAttempt)=>{const verified=await check(actor,attempt);const data=await verified.json();if(verified.status!==200||data.command?.state!=='committed'||data.command?.id!==attempt.envelope.commandId||data.command?.kind!==attempt.kind)return false;const records=read(actor);const id=slot(attempt.kind,attempt.envelope.payload);if(records[id]?.envelope.commandId!==attempt.envelope.commandId)return false;records[`archive:${attempt.envelope.commandId}`]={...records[id],archived:true};delete records[id];write(actor,records);return true;}
 };
}
export function browserCommandClient(){return createCommandClient({storage:localStorage,fetch:(url,init)=>globalThis.fetch(url,init),uuid:()=>crypto.randomUUID(),changed:()=>window.dispatchEvent(new Event('iqon-command-change'))});}
