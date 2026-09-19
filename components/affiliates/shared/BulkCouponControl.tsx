"use client";
import {useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {createBulkClient,type BulkDTO} from '@/lib/affiliates/canonical-bulk-client';
import {currentCommandActor} from '@/lib/affiliates/canonical-action-fetch';
/** Native all-active action; never mapped to the single-affiliate sync command. */
export function BulkCouponControl(){
 const [status,setStatus]=useState<BulkDTO|null>(null);
 const [error,setError]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const client=useRef<ReturnType<typeof createBulkClient>|null>(null);
 const locked=useRef(false);const mounted=useRef(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 async function step(start=false){
  if(locked.current)return;locked.current=true;setBusy(true);setError(null);
  if(timer.current)clearTimeout(timer.current);
  try{
   const {actor,session}=await currentCommandActor();
   if(session.role!=='admin')throw Error('Current administrator access required. Admission stopped.');
   client.current??=createBulkClient({storage:localStorage,uuid:()=>crypto.randomUUID(),fetch:(url,init)=>globalThis.fetch(url,init)});
   const next=await client.current.advance(actor,start);
   if(!mounted.current)return;
   setStatus(next);
   // Bounded admission and provider status polling, with backoff between passes.
   if(next&&next.remaining>0)timer.current=setTimeout(()=>void step(),next.targets.some(t=>t.commandVersion===null)?5000:15000);
  }catch(e){if(mounted.current){setStatus(null);setError(e instanceof Error?e.message:'Bulk status unavailable. Saved attempt retained.');}}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 useEffect(()=>{mounted.current=true;void step();return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);};},[]);
 return <div className="space-y-2">
  <button onClick={()=>void step(true)} disabled={busy} className="inline-flex items-center gap-2 glass-surface rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.18em] font-sans text-[#20282c] hover:bg-white/80 transition-colors disabled:opacity-60" title="Freeze all active canonical affiliates; resume the same scoped batch">
   <RefreshCw className={`h-3.5 w-3.5 ${busy?'animate-spin':''}`}/>{busy?'Checking…':status||error?'Retry / check coupon batch':'Sync Coupons'}
  </button>
  {error&&<p role="alert" className="text-xs text-red-600">{error} Retry resumes the saved batch; no completion confirmed.</p>}
  {status&&<div role="status" className="text-xs space-y-1">
   <p>{status.remaining} of {status.total} not confirmed. Providers disabled — queued work is not activation.</p>
   <p>{status.targets.filter(t=>t.commandVersion===null).length} awaiting admission. Batch {status.batchId}</p>
   <details><summary>Store status and recovery events</summary>{status.targets.map(t=><div key={t.affiliateId}><p>{t.affiliateId}: {t.state}</p>{t.outbox.map((o,i)=><p key={i}>{o.store} / {o.operation}: {o.state}{o.reason?` — ${o.reason}`:''}</p>)}{t.events.map(e=><p key={e.id}>{e.store}: {e.outcome} ({e.createdAt})</p>)}</div>)}</details>
  </div>}
 </div>;
}
