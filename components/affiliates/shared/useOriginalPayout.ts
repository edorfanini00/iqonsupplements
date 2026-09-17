"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {requestProgram,ProgramRequestError} from './program-api';
import {settlementPlan,payoutAttemptDisposition,type ProgramOrder,type ProgramReport} from './program-view';
type Attempt = {idempotencyKey:string;payload:string;rejectedStatus?:number};
/** Original modal controller, retaining the shared settlement protocol independently of presentation. */
export function useOriginalPayout(affiliateId:string,onDone:()=>void) {
  const refresh=async()=> (await requestProgram(`/api/affiliates/admin/program?category=all&affiliateId=${encodeURIComponent(affiliateId)}`)).report as ProgramReport;
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [full,setFull]=useState<ProgramOrder[]|null>(null);
  const [method,setMethod]=useState('bank');
  const [reference,setReference]=useState('');
  const [notes,setNotes]=useState('');
  const [paidAt,setPaidAt]=useState(new Date().toISOString().slice(0,10));
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [canCorrect,setCanCorrect]=useState(false);
  const [locked,setLocked]=useState(false);
  const submitting=useRef(false);
  const pending=useRef<Attempt|null>(null);
  const storage=`iqon-payout-attempt:${affiliateId}`;
  const readFull=useCallback(async()=>{
    const data=await requestProgram(`/api/affiliates/admin/program?category=all&affiliateId=${encodeURIComponent(affiliateId)}`);
    if(!data.report || !Array.isArray(data.report.orders) || !Array.isArray(data.report.payouts))throw new Error('Complete settlement ledger unavailable.');
    return data.report as ProgramReport;
  },[affiliateId]);
  useEffect(()=>{
    let alive=true;
    void readFull().then(r=>{if(alive){setFull(r.orders);if(!pending.current){const positive=r.orders.filter(o=>o.affiliateId===affiliateId&&o.outstandingAmount>0);if(new Set(positive.map(o=>o.currency)).size===1)setDraft(Object.fromEntries(positive.map(o=>[o.id,String(o.outstandingAmount)])));}}}).catch(e=>{if(alive)setError(e.message);});
    try {
      const attempt=JSON.parse(sessionStorage.getItem(storage)||'null') as Attempt|null;
      if(attempt?.payload && attempt.idempotencyKey){
        const original=JSON.parse(attempt.payload);
        pending.current=attempt;setLocked(true);
        setDraft(Object.fromEntries(original.allocations.filter((a:{amount:number})=>a.amount>0).map((a:{orderId:string;amount:number})=>[a.orderId,String(a.amount)])));
        setMethod(original.method);setReference(original.reference);setNotes(original.notes??'');
        const date=new Date(original.paidAt);setPaidAt(new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10));
        setError('An unresolved attempt was restored. Check its canonical record or retry the same token; do not make another external payment.');
      }
    }catch{setError('Previous attempt storage could not be read. Check the canonical audit before recording.');}
    return()=>{alive=false;};
  },[storage,readFull]);

  let plan:ReturnType<typeof settlementPlan>|null=null,planError='';
  if(full&&Object.values(draft).some(Boolean))try{plan=settlementPlan(full,draft,affiliateId);}catch(e){planError=e instanceof Error?e.message:'Invalid plan';}
  const selectedCurrencies=new Set(Object.keys(draft).filter(id=>draft[id]).map(id=>full?.find(o=>o.id===id)?.currency));
  const negatives=full?.filter(o=>o.affiliateId===affiliateId&&o.outstandingAmount<0&&selectedCurrencies.has(o.currency))??[];

  async function finish(){
    sessionStorage.removeItem(storage);pending.current=null;setLocked(false);
    await refresh().catch(()=>{});onDone();
  }
  async function resolveAttempt(httpStatus?:number){
    const attempt=pending.current;if(!attempt)return;
    const r=await readFull();setFull(r.orders);
    const found=r.payouts.some(p=>p.idempotencyKey===attempt.idempotencyKey);
    const outcome=payoutAttemptDisposition(httpStatus??attempt.rejectedStatus,true,found);
    if(outcome==='recorded'){await finish();return;}
    if(outcome==='correctable'){
      attempt.rejectedStatus=httpStatus??attempt.rejectedStatus;sessionStorage.setItem(storage,JSON.stringify(attempt));
      setCanCorrect(true);setError('The server rejected this payload and the complete canonical ledger confirms no payout exists for its token. Acknowledge below to correct the allocation. No payment record was created.');
    }else setError('No record is visible yet, but the outcome is uncertain. Keep the original token and retry it; a missing record alone is not permission to start a new payment.');
  }
  function correct(){
    if(!canCorrect)return;
    sessionStorage.removeItem(storage);pending.current=null;setLocked(false);setCanCorrect(false);setConfirmed(false);
    setError('Rejected attempt cleared after canonical readback. Review updated balances and required adjustments, then confirm the corrected payment record.');
  }
  async function submit(){
    if(submitting.current||!confirmed||canCorrect)return;
    submitting.current=true;setBusy(true);setError('');
    try{
      if(!pending.current){
        if(!full||!plan)throw new Error(planError||'Load and review the full settlement plan first.');
        if(!reference.trim()||!paidAt||!Number.isFinite(new Date(`${paidAt}T12:00:00`).getTime()))throw new Error('Payment reference and completion time are required.');
        const latest=await readFull();setFull(latest.orders);
        const current=settlementPlan(latest.orders,draft,affiliateId);
        if(JSON.stringify(current)!==JSON.stringify(plan))throw new Error('Balances or mandatory adjustments changed. Review the updated settlement plan before confirming again.');
        const payload=JSON.stringify({affiliateId,method,reference:reference.trim(),notes:notes.trim()||undefined,paidAt:new Date(`${paidAt}T12:00:00`).toISOString(),amount:current.amount,allocations:current.allocations,orderIds:current.allocations.map(a=>a.orderId)});
        pending.current={idempotencyKey:crypto.randomUUID(),payload};
        sessionStorage.setItem(storage,JSON.stringify(pending.current));setLocked(true);
      }
      const attempt=pending.current!;
      const response=await requestProgram('/api/affiliates/admin/payouts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...JSON.parse(attempt.payload),idempotencyKey:attempt.idempotencyKey})});
      const r=await readFull();
      if(!response.payout?.id||!r.payouts.some(p=>p.id===response.payout.id&&p.idempotencyKey===attempt.idempotencyKey))throw new Error('Payment response received, but exact canonical readback is not confirmed. Retry the original token.');
      await finish();
    }catch(e){
      setError(e instanceof Error?e.message:'Payment outcome uncertain.');
      if(pending.current&&e instanceof ProgramRequestError&&(e.status===400||e.status===422)){
        pending.current.rejectedStatus=e.status;sessionStorage.setItem(storage,JSON.stringify(pending.current));
        try{await resolveAttempt(e.status);}catch{setError('Validation response received, but canonical lookup failed. Original token retained until lookup succeeds.');}
      }
    }finally{submitting.current=false;setBusy(false);}
  }
 return {draft,setDraft,full,method,setMethod,reference,setReference,notes,setNotes,paidAt,setPaidAt,confirmed,setConfirmed,busy,error,canCorrect,locked,plan,planError,negatives,submit,correct,resolveAttempt,token:pending.current?.idempotencyKey};
}
