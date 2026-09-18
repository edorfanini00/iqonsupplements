export interface BulkDTO {
 version:1; batchId:string; portal:'health'|'supplements'; total:number; remaining:number; providerActivation:'disabled';
 targets:{affiliateId:string;commandId:string;commandVersion:number|null;state:'queued'|'pending'|'confirmed'|'conflict'|'superseded';outbox:{store:string;operation:string;state:string;reason:string|null}[];events:{id:string;store:'woo'|'shopify';outcome:string;states:{state:string;count:number}[];createdAt:string}[]}[];
}
type Options={storage:Pick<Storage,'getItem'|'setItem'>;uuid:()=>string;fetch:(url:string,init?:RequestInit)=>Promise<Response>};
const base='/api/affiliates/commands/creator-code-bulk';
/** One persisted, actor-scoped all-active selection. Each step performs at most
 * one admission pass. Provider-pending children are polled, never reissued. */
export function createBulkClient(options:Options){
 const states=new Map<string,BulkDTO>();
 return {async advance(actor:string,start=false):Promise<BulkDTO|null>{
  const key=`iqon:bulk:v1:${actor}`;
  let raw=options.storage.getItem(key);let fresh=false;
  if(!raw){if(!start)return null;raw=JSON.stringify({version:1,batchId:options.uuid(),selection:{}});options.storage.setItem(key,raw);fresh=true;}
  const envelope=JSON.parse(raw) as {version:number;batchId:string;selection:Record<string,never>};
  if(envelope.version!==1||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(envelope.batchId)||Object.keys(envelope.selection).length)throw Error('Invalid saved bulk attempt. No request sent.');
  const previous=states.get(actor);const admit=previous?.targets.some(t=>t.commandVersion===null);
  const request=(create:boolean)=>options.fetch(create?base:`${base}/${envelope.batchId}`,{method:create||admit?'POST':'GET',credentials:'include',cache:'no-store',...(create?{headers:{'content-type':'application/json'},body:raw!}:{})});
  let response=await request(fresh);
  if(response.status===404&&!fresh)response=await request(true);
  if(!response.ok){states.delete(actor);throw Error(`Bulk request ${response.status}. Attempt retained; retry after current access is restored.`);}
  const data=await response.json() as BulkDTO;
  if(data.version!==1||data.batchId!==envelope.batchId||data.portal!=='supplements'||data.providerActivation!=='disabled'||!Array.isArray(data.targets)||data.total!==data.targets.length||!Number.isInteger(data.remaining)||data.remaining<0||data.remaining>data.total)throw Error('Invalid bulk status. Attempt retained.');
  states.set(actor,data);return data;
 }};
}
