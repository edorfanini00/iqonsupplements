"use client";
import {browserCommandClient,type CommandKind,type CommandResponse} from './canonical-command-client';
import {parseBodySession} from './body-session-dto';
export function mapLegacyCommand(path:string,method:string,payload:Record<string,unknown>):{kind:CommandKind;payload:Record<string,unknown>}|null {
 if(path==='/api/affiliates/admin/create'&&method==='POST'){
  // Canonical admin provisioning owns identity setup; the legacy password is
  // not accepted by its DTO and must never enter the durable attempt journal.
  const {password:_legacyPassword,...canonicalPayload}=payload;
  return {kind:'admin-create',payload:canonicalPayload};
 }
 if(path==='/api/affiliates/signup'&&method==='POST')return {kind:'signup',payload};
 const approval=/^\/api\/affiliates\/admin\/requests\/([A-Za-z0-9_-]+)$/.exec(path);
 if(approval&&['POST','DELETE'].includes(method))return {kind:'affiliate-approval',payload:{...payload,affiliateId:approval[1],decision:method==='POST'?'approve':'deny'}};
 const settings=/^\/api\/affiliates\/admin\/affiliates\/([A-Za-z0-9_-]+)$/.exec(path);
 if(settings&&method==='PATCH')return {kind:'commission-settings',payload:{...payload,affiliateId:settings[1]}};
 if(path==='/api/affiliates/admin/payouts'&&method==='POST')return {kind:'payout-record',payload};
 if(path==='/api/affiliates/admin/code-sync'&&method==='POST')return {kind:'creator-code-sync',payload};
 if(path==='/api/affiliates/admin/rates'&&method==='PUT')return {kind:'commission-settings',payload};
 return null;
}
const fail=(error:string,status=0):CommandResponse=>({ok:false,status,json:async()=>({ok:false,error})});
export async function currentCommandActor(){
 const res=await globalThis.fetch('/api/affiliates/shared-session',{credentials:'include',cache:'no-store'});
 if(!res.ok)throw Error('Current canonical session unavailable. Please sign in.');
 const session=parseBodySession(await res.json());
 if(!session)throw Error('Current canonical session unavailable. Please sign in.');
 return {actor:`wp:${session.wpUserId}`,session};
}
/** Existing page fetch interface, narrowly mapped writes only. No global fetch
 * patching: all other original reads/actions still traverse the reviewed BFF. */
export async function canonicalActionFetch(input:string,init?:RequestInit):Promise<Response|CommandResponse>{
 const method=init?.method?.toUpperCase()??'GET';
 let payload:Record<string,unknown>={};
 try{if(typeof init?.body==='string')payload=JSON.parse(init.body);}catch{return fail('Invalid command payload. Nothing submitted.');}
 const mapped=mapLegacyCommand(input,method,payload);
 if(!mapped)return globalThis.fetch(input,init);
 try{
  const client=browserCommandClient();
  if(mapped.kind==='signup')return client.submit(`signup:${String(mapped.payload.email??'').trim().toLowerCase()}`,mapped.kind,mapped.payload);
  const {actor,session}=await currentCommandActor();
  if(session.role!=='admin')return fail('This command requires a current canonical administrator.',403);
  const existing=client.list(actor).find(a=>!a.archived&&a.kind===mapped.kind&&(a.envelope.payload.affiliateId??a.envelope.payload.email)===(mapped.payload.affiliateId??mapped.payload.email));
  let version=existing?.envelope.expectedVersion;
  if(!['payout-record','admin-create'].includes(mapped.kind)&&!existing){
   // Dedicated canonical state read; never assume zero or infer a version from
   // profile dates when the dependency is unavailable.
   const res=await globalThis.fetch(`/api/affiliates/commands/state/${encodeURIComponent(String(mapped.payload.affiliateId))}`,{credentials:'include',cache:'no-store'});
   const data=await res.json();
   version=data.version;
   if(!res.ok||data.affiliateId!==mapped.payload.affiliateId||!Number.isSafeInteger(version)||version!<0)return fail('Canonical command version is unavailable. The Health command candidate must be deployed before this action can be submitted.');
  }
  return client.submit(actor,mapped.kind,mapped.payload,version);
 }catch{return fail('Canonical command/session or attempt storage unavailable. No completion has been confirmed.');}
}
