"use client";
import {useCallback,useEffect,useState} from 'react';
import {useLatestRead} from './use-latest-read';
import {currentCommandActor,canonicalActionFetch} from './canonical-action-fetch';
import {browserCommandClient,type SavedAttempt} from './canonical-command-client';
export type OutstandingBucket={currency:string|null;amount:number;payable:boolean;allocations:{orderId:string;amount:number}[]};
function parse(raw:unknown,affiliateId:string):OutstandingBucket[]{
 const value=raw as {ok?:unknown;version?:unknown;scope?:unknown;affiliateId?:unknown;buckets?:unknown}|null;
 if(value?.ok!==true||value.version!==1||value.scope!=='all-time'||value.affiliateId!==affiliateId||!Array.isArray(value.buckets))throw Error('Canonical outstanding is unavailable.');
 const buckets=value.buckets as OutstandingBucket[];
 const seen=new Set<string|null>();
 for(const b of buckets){
  if(!b||!(b.currency===null||typeof b.currency==='string')||seen.has(b.currency)||!Number.isFinite(b.amount)||typeof b.payable!=='boolean'||!Array.isArray(b.allocations))throw Error('Invalid outstanding buckets.');
  seen.add(b.currency);const ids=new Set<string>();let total=0;
  for(const a of b.allocations){if(!a||typeof a.orderId!=='string'||!a.orderId||ids.has(a.orderId)||!Number.isFinite(a.amount)||a.amount===0)throw Error('Invalid outstanding allocations.');ids.add(a.orderId);total+=Math.round(a.amount*100);}
  if(total!==Math.round(b.amount*100)||b.payable&&(!b.currency||! /^[A-Z]{3}$/.test(b.currency)||b.amount<=0||!b.allocations.length))throw Error('Invalid outstanding balance.');
 }
 return buckets;
}
async function read(affiliateId:string,signal?:AbortSignal){
 const res=await globalThis.fetch(`/api/affiliates/payouts/outstanding?affiliateId=${encodeURIComponent(affiliateId)}`,{credentials:'include',cache:'no-store',signal});
 if(!res.ok)throw Error('Canonical outstanding is unavailable. Close and reopen to retry.');
 return parse(await res.json(),affiliateId);
}
const metaKey=(actor:string,id:string)=>`iqon-body:payout-review:v1:${actor}:${id}`;
export function usePayoutOutstanding(affiliateId:string){
 const [buckets,setBuckets]=useState<OutstandingBucket[]>([]),[currency,setCurrency]=useState<string|null>(null);
 const [saved,setSaved]=useState<SavedAttempt|null>(null),[savedCurrency,setSavedCurrency]=useState<string|null>(null);
 const [actor,setActor]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState<string|null>(null);
 const begin=useLatestRead();
 const refresh=useCallback(async()=>{
  const request=begin();setBuckets([]);setCurrency(null);setSaved(null);setSavedCurrency(null);setBusy(true);setError(null);
  try{
   const identity=await currentCommandActor();if(!request.isCurrent())return;
   if(identity.session.role!=='admin')throw Error('A current administrator is required.');
   setActor(identity.actor);
   const attempt=browserCommandClient().list(identity.actor).find(a=>!a.archived&&a.kind==='payout-record'&&a.envelope.payload.affiliateId===affiliateId)??null;
   setSaved(attempt);
   if(attempt){try{const meta=JSON.parse(localStorage.getItem(metaKey(identity.actor,affiliateId))??'null');if(JSON.stringify(meta?.payload)===JSON.stringify(attempt.envelope.payload))setSavedCurrency(meta.currency);}catch{/* A missing display hint never alters an immutable command. */}}
   const next=await read(affiliateId,request.signal);if(!request.isCurrent())return;
   setBuckets(next);setCurrency(next.find(b=>b.payable)?.currency??next[0]?.currency??null);
  }catch(e){if(request.isCurrent()){setBuckets([]);setCurrency(null);setError(e instanceof Error?e.message:'Outstanding unavailable.');}}
  finally{if(request.isCurrent())setBusy(false);}
 },[affiliateId,begin]);
 // Clearing stale settlement before starting external I/O is intentional.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void refresh();},[refresh]);
 const bucket=buckets.find(b=>b.currency===currency);
 async function submit(fields:Record<string,unknown>):Promise<boolean>{
  if(busy)return false;setBusy(true);setError(null);
  try{
   let payload=saved?.envelope.payload;
   if(!payload){
    if(!bucket?.payable)throw Error('Select a payable currency bucket.');
    let latest:OutstandingBucket[];
    try{latest=await read(affiliateId);}catch(e){setBuckets([]);setCurrency(null);throw e;}
    const selected=latest.find(b=>b.currency===bucket.currency);
    setBuckets(latest);
    if(!selected||JSON.stringify(selected)!==JSON.stringify(bucket))throw Error('Outstanding changed. Review the updated currency amount and allocations, then submit again.');
    payload={affiliateId,...fields,amount:selected.amount,allocations:selected.allocations};
    // Display-only hint: never dispatched and never used to infer allocations.
    localStorage.setItem(metaKey(actor,affiliateId),JSON.stringify({currency:selected.currency,payload}));
    setSavedCurrency(selected.currency);
   }
   const res=await canonicalActionFetch('/api/affiliates/admin/payouts',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
   const data=await res.json();
   setSaved(browserCommandClient().list(actor).find(a=>!a.archived&&a.kind==='payout-record'&&a.envelope.payload.affiliateId===affiliateId)??null);
   if(!res.ok)throw Error(typeof data.error==='string'?data.error:'Payout not confirmed. Keep the saved attempt.');
   return true;
  }catch(e){setError(e instanceof Error?e.message:'Payout not confirmed.');return false;}
  finally{setBusy(false);}
 }
 async function correct(){
  if(!saved||busy)return;setBusy(true);setError(null);
  try{if(!await browserCommandClient().allowCorrection(actor,saved))throw Error('Correction unavailable: the original command must be definitively rejected with canonical no-record readback.');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Correction unavailable.');}finally{setBusy(false);}
 }
 const display=saved?{currency:savedCurrency,amount:Number(saved.envelope.payload.amount),allocations:(saved.envelope.payload.allocations??[]) as OutstandingBucket['allocations']}:bucket;
 return {buckets,bucket,display,currency,setCurrency,saved,busy,error,submit,correct,canSubmit:!busy&&(!!saved||!!bucket?.payable)};
}
export const payoutMoney=(amount:number,currency:string|null)=>`${currency??'Unknown currency'} ${amount.toFixed(2)}`;
