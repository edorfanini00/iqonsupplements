"use client";
import {useEffect,useState} from 'react';
import {canonicalActionFetch} from '@/lib/affiliates/canonical-action-fetch';
type TermsInput={purchaseOneTime:boolean;purchaseSubscription:boolean;eligibility:''|'all';combineOrder:''|'yes'|'no';combineProduct:''|'yes'|'no';combineShipping:''|'yes'|'no';cycleLimit:string;referralBase:''|'revenue'|'commission';category:'peptides'|'supplements'|'skincare';direct:string;recurring:string;referral:string;discount:string;effective:string;products:string};
export function buildCategoryTerms(input:TermsInput){
 const percent=(value:string)=>{if(!value.trim()||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>100)throw Error('Enter each rate explicitly from 0 to 100; blanks are not zero.');return Number(value);};
 if(!['revenue','commission'].includes(input.referralBase))throw Error('Choose the explicitly agreed referral base.');
 const effectiveAt=new Date(input.effective);if(!input.effective||!Number.isFinite(effectiveAt.getTime()))throw Error('Select the agreed effective date and time.');
 const eligibleProductIds=input.products.split(/[\s,]+/).filter(Boolean);
 if(input.category!=='peptides'&&!eligibleProductIds.length)throw Error('Supply the explicitly agreed Shopify product IDs.');
 const purchaseTypes=[...(input.purchaseOneTime?['one_time']:[]),...(input.purchaseSubscription?['subscription']:[])];
 if(input.category!=='peptides'&&(!purchaseTypes.length||input.eligibility!=='all'||[input.combineOrder,input.combineProduct,input.combineShipping].some(v=>!['yes','no'].includes(v))))throw Error('Explicitly choose purchase eligibility, customer eligibility and each discount-combination policy.');
 if(input.category!=='peptides'&&input.purchaseSubscription&&(!input.cycleLimit.trim()||!Number.isSafeInteger(Number(input.cycleLimit))||Number(input.cycleLimit)<0||Number(input.cycleLimit)>1000))throw Error('Specify subscription billing cycles (0–1000; 0 is unlimited).');
 const policy=input.category==='peptides'?{}:{purchaseTypes,customerEligibility:input.eligibility,combinesWith:{orderDiscounts:input.combineOrder==='yes',productDiscounts:input.combineProduct==='yes',shippingDiscounts:input.combineShipping==='yes'},...(input.purchaseSubscription?{recurringCycleLimit:Number(input.cycleLimit)}:{})};
 return {...policy,store:input.category==='peptides'?'woo':'shopify',category:input.category,directRate:percent(input.direct),recurringRate:percent(input.recurring),referralRate:percent(input.referral),customerDiscount:percent(input.discount),referralBase:input.referralBase,effectiveAt:effectiveAt.toISOString(),eligibleProductIds};
}
/** Additional controls inside the existing affiliate detail, not a replacement
 * dashboard. Original Health rates/forms remain unchanged above this panel. */
export function CanonicalAffiliateControls({affiliateId,ratesOnly=false}:{affiliateId:string;ratesOnly?:boolean}){
 const [terms,setTerms]=useState<TermsInput>({purchaseOneTime:false,purchaseSubscription:false,eligibility:'',combineOrder:'',combineProduct:'',combineShipping:'',cycleLimit:'',referralBase:'',category:'supplements',direct:'',recurring:'',referral:'',discount:'',effective:'',products:''});
 const [context,setContext]=useState<{id:string;data?:{version:number;terms:Array<{store:string;category:string;version:number;terms:Record<string,unknown>}>;outbox:Array<{store:string;operation:string;state:string;reason?:string}>};error?:string}>({id:''});
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const c=new AbortController();setContext({id:affiliateId});void (async()=>{try{const res=await fetch(`/api/affiliates/commands/state/${encodeURIComponent(affiliateId)}`,{credentials:'include',cache:'no-store',signal:c.signal});const data=await res.json();if(!res.ok||data.affiliateId!==affiliateId||!Number.isSafeInteger(data.version)||!Array.isArray(data.terms)||!Array.isArray(data.outbox))throw Error('unavailable');if(!c.signal.aborted)setContext({id:affiliateId,data});}catch{if(!c.signal.aborted)setContext({id:affiliateId,error:'Canonical settings unavailable. Existing Overview and profile data are unchanged.'});}})();return()=>c.abort();},[affiliateId,refresh]);
 const current=context.id===affiliateId?context:undefined;
 const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 const inputClass='bg-transparent border-0 border-b border-[#242526]/15 rounded-none px-0 py-2.5 text-sm focus:outline-none focus:border-[#242526] w-full';
 async function submit(kind:'rates'|'code'){
  setBusy(true);setMessage('');
  try{
   if(!current?.data)throw Error('Load canonical settings before submitting.');
   const payload=kind==='rates'?{affiliateId,rates:[buildCategoryTerms(terms)]}:{affiliateId,...(code.trim()?{promoCode:code.trim()}:{})};
   const res=await canonicalActionFetch(`/api/affiliates/admin/${kind==='rates'?'rates':'code-sync'}`,{method:kind==='rates'?'PUT':'POST',body:JSON.stringify(payload),headers:{'Content-Type':'application/json'},credentials:'include'},current.data.version);
   const data=await res.json();setRefresh(n=>n+1);setMessage(res.ok?'Canonical command completed. Read back provider verification before advertising a code.':typeof data.error==='string'?data.error:'Not confirmed complete. Check Command recovery.');
  }catch(error){setMessage(error instanceof Error?error.message:'Command unavailable. No completion confirmed.');}finally{setBusy(false);}
 }
 return <section aria-label="Canonical category settings" className="glass-surface rounded-lg p-6 md:p-7 mb-8">
  <details open={ratesOnly||undefined}><summary className="text-xl font-medium cursor-pointer">{ratesOnly?'Category commission terms & customer discount policy':'Category commission terms & code verification'}</summary>
   <p className="text-sm text-[#64717a] mt-3">Explicit prospective terms only. No default rates, retroactive repricing, or automatic commission activation. Saving an agreement does not prove Woo or Shopify code availability.</p>
   <div className="mt-4 text-sm">
    {current?.data?<><p>Current canonical version: {current.data.version}</p>
     {current.data.terms.map((row,index)=><div key={index} className="border-t border-[#242526]/10 pt-2 mt-2 text-xs text-[#64717a]"><p>{row.category} · {row.store} · version {row.version}</p><p>Direct {String(row.terms.directRate)}% · recurring {String(row.terms.recurringRate)}% · referral {String(row.terms.referralRate)}% · customer discount {String(row.terms.customerDiscount)}%</p><p>Referral base: {String(row.terms.referralBase)} · effective {String(row.terms.effectiveAt)}</p><details><summary>Saved checkout policy and product scope</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(row.terms,null,2)}</pre></details></div>)}
     {['supplements','skincare'].filter(category=>!current.data!.terms.some(row=>row.category===category)).map(category=><p key={category} className="text-xs text-[#64717a]">{category}: Unconfigured — inactive; no Health rates copied.</p>)}
     {!current.data.terms.length&&<p className="text-xs text-[#64717a]">No canonical category terms recorded.</p>}
     {current.data.outbox.map((row,index)=><p key={index} className="text-xs text-[#64717a]">{row.store} · {row.operation} · {row.state}{row.reason?` — ${row.reason}`:''}</p>)}
    </>:<p>{current?.error??'Loading canonical settings…'}</p>}
    <button type="button" className="underline text-xs mt-2" onClick={()=>setRefresh(n=>n+1)}>Refresh canonical settings</button>
   </div>
   <form onSubmit={e=>{e.preventDefault();void submit('rates');}} className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
    <label className="text-sm">Category<select className={inputClass} value={terms.category} onChange={e=>setTerms({purchaseOneTime:false,purchaseSubscription:false,eligibility:'',combineOrder:'',combineProduct:'',combineShipping:'',cycleLimit:'',referralBase:'',category:e.target.value as TermsInput['category'],direct:'',recurring:'',referral:'',discount:'',effective:'',products:''})}><option value="supplements">Supplements · Shopify</option><option value="skincare">Skincare · Shopify</option><option value="peptides">Peptides · Woo</option></select></label>
    {([['direct','Direct commission'],['recurring','Recurring commission'],['referral','Referral commission'],['discount','Customer discount']] as const).map(([key,label])=><label key={key} className="text-sm">{label} (%)<input type="number" required min="0" max="100" step="0.01" value={terms[key]} className={inputClass} onChange={e=>setTerms({...terms,[key]:e.target.value})}/></label>)}
    <label className="text-sm">Referral base<select required className={inputClass} value={terms.referralBase} onChange={e=>setTerms({...terms,referralBase:e.target.value as TermsInput['referralBase']})}><option value="">Choose agreed base</option><option value="revenue">Revenue</option><option value="commission">Commission</option></select></label>
    <label className="text-sm">Effective at (your local time)<input type="datetime-local" required className={inputClass} value={terms.effective} onChange={e=>setTerms({...terms,effective:e.target.value})}/></label>
    <label className="text-sm md:col-span-2">Eligible product IDs (explicit, comma separated)<input required={terms.category!=='peptides'} className={inputClass} value={terms.products} onChange={e=>setTerms({...terms,products:e.target.value})}/></label>
    {terms.category!=='peptides'&&<fieldset className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#242526]/10 pt-4"><legend className="text-sm font-medium">Explicit Shopify eligibility</legend>
     <label className="text-sm"><input type="checkbox" checked={terms.purchaseOneTime} onChange={e=>setTerms({...terms,purchaseOneTime:e.target.checked})}/> One-time purchases</label>
     <label className="text-sm"><input type="checkbox" checked={terms.purchaseSubscription} onChange={e=>setTerms({...terms,purchaseSubscription:e.target.checked})}/> Subscriptions</label>
     {terms.purchaseSubscription&&<label className="text-sm">Recurring cycle limit (0 means unlimited)<input type="number" min="0" max="1000" step="1" required className={inputClass} value={terms.cycleLimit} onChange={e=>setTerms({...terms,cycleLimit:e.target.value})}/></label>}
     <label className="text-sm">Customer eligibility<select required className={inputClass} value={terms.eligibility} onChange={e=>setTerms({...terms,eligibility:e.target.value as TermsInput['eligibility']})}><option value="">Choose agreed eligibility</option><option value="all">All customers</option></select></label>
     {([['combineOrder','Combine with order discounts'],['combineProduct','Combine with product discounts'],['combineShipping','Combine with shipping discounts']] as const).map(([key,label])=><label key={key} className="text-sm">{label}<select required className={inputClass} value={terms[key]} onChange={e=>setTerms({...terms,[key]:e.target.value})}><option value="">Choose agreed policy</option><option value="no">No</option><option value="yes">Yes</option></select></label>)}
    </fieldset>}
    <p className="text-xs text-[#64717a] md:col-span-2">The referral base must match the agreement. Category settings are separate from original Health profile settings. Provider activation may remain blocked pending canonical qualification.</p>
    <button disabled={busy} className="rounded-full px-4 py-2 bg-[#242526] text-white text-xs disabled:opacity-50">{busy?'Submitting…':'Save explicit category terms'}</button>
   </form>
   {!ratesOnly&&<form className="mt-6 border-t border-[#242526]/10 pt-5" onSubmit={e=>{e.preventDefault();void submit('code');}}>
    <label className="text-sm">Creator code (leave blank to verify current canonical code)<input className={inputClass} value={code} onChange={e=>setCode(e.target.value)}/></label>
    <button disabled={busy} className="rounded-full px-4 py-2 bg-[#242526] text-white text-xs mt-4 disabled:opacity-50">Verify creator code</button>
   </form>}
  </details>
  {message&&<p role="status" className="text-sm mt-4">{message}</p>}
 </section>;
}
