"use client";
import {useEffect,useState} from 'react';
import {browserCommandClient,type SavedAttempt} from '@/lib/affiliates/canonical-command-client';
import {currentCommandActor} from '@/lib/affiliates/canonical-action-fetch';

export function CommandRecovery(){
 const [actor,setActor]=useState<string|null>(null);
 const [attempts,setAttempts]=useState<SavedAttempt[]>([]);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const load=async()=>{try{const current=await currentCommandActor();if(active){setActor(current.actor);setAttempts(browserCommandClient().list(current.actor));}}catch{if(active){setActor(null);setAttempts([]);}}};
  void load();window.addEventListener('iqon-command-change',load);window.addEventListener('storage',load);
  return ()=>{active=false;window.removeEventListener('iqon-command-change',load);window.removeEventListener('storage',load);};
 },[]);
 async function run(attempt:SavedAttempt,action:'check'|'retry'|'finish'|'correct'){
  setBusy(true);setMessage('');
  try{
   const current=await currentCommandActor();if(current.actor!==actor)throw Error('Account changed. Reload before continuing.');
   const client=browserCommandClient();
   if(action==='correct'){
    const allowed=await client.allowCorrection(current.actor,attempt);setMessage(allowed?'Validation rejection and canonical no-record verified. You may correct the form and submit a new attempt.':'No-record proof unavailable. The exact attempt is retained.');
   }else if(action==='finish'){
    const done=await client.finish(current.actor,attempt);setMessage(done?'Canonical commit verified. Receipt archived; pending provider tasks are NOT completed. You may now explicitly start a separate operation.':'Completion could not be verified. Attempt retained.');
   }else{
    const res=action==='check'?await client.check(current.actor,attempt):await client.submit(current.actor,attempt.kind,attempt.envelope.payload,attempt.envelope.expectedVersion);
    const data=await res.json();
    setMessage(res.ok?'Canonical completion verified. Reload this page to read the updated data.':typeof data.error==='string'?data.error:`Command ${data.command?.state??'unknown'}. Not confirmed complete. Saved key retained.`);
   }
   setAttempts(client.list(current.actor));
  }catch(error){setMessage(error instanceof Error?error.message:'Receipt unavailable. Attempt retained.');}finally{setBusy(false);}
 }
 if(!attempts.length)return null;
 return <section className="glass-surface rounded-lg p-5 mb-6" aria-label="Command recovery">
  <details><summary className="text-sm font-medium cursor-pointer">Command recovery · {attempts.length} saved {attempts.length===1?'attempt':'attempts'}</summary>
   <p className="text-xs text-[#64717a] mt-3">Saved attempts survive closing a form and reloading. Pending is not completed; code activation requires provider verification. A payout records a payment already made, not a bank transfer.</p>
   {attempts.map(a=><article key={a.envelope.commandId} className="border-t border-[#242526]/10 mt-4 pt-4 text-sm">
    <p>{a.kind} · {a.state}{a.archived?' · archived receipt':''}</p>
    {a.outbox?.map((task,index)=><p key={index} className="text-xs text-[#64717a]">{task.store} · {task.operation} · {task.state}{task.reason?` — ${task.reason}`:''}</p>)}<p className="text-xs break-all text-[#64717a]">{a.envelope.commandId}</p>
    <details className="my-2"><summary>Review exact saved payload</summary><pre className="text-xs whitespace-pre-wrap break-all mt-2">{JSON.stringify(a.envelope.payload,null,2)}</pre></details>
    <div className="flex flex-wrap gap-3">
     <button disabled={busy} className="underline disabled:opacity-50" onClick={()=>run(a,'check')}>Check canonical status</button>
     {!a.archived&&a.kind!=='signup'&&<button disabled={busy} className="underline disabled:opacity-50" onClick={()=>run(a,'retry')}>Retry saved attempt</button>}
     {!a.archived&&a.rejected&&a.kind!=='signup'&&<button disabled={busy} className="underline disabled:opacity-50" onClick={()=>run(a,'correct')}>Verify no record and allow correction</button>}
     {!a.archived&&a.state==='committed'&&<button disabled={busy} className="underline disabled:opacity-50" onClick={()=>run(a,'finish')}>Verify commit and start a separate operation</button>}
    </div>
   </article>)}
  </details>
  {message&&<p role="status" className="text-sm mt-3">{message}</p>}
 </section>;
}
