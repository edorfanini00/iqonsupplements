"use client";
import {useEffect,useState} from 'react';
import {useCalendarDay} from '@/components/affiliates/shared/useCalendarDay';
import {resolveRange} from '@/lib/affiliates/time-series';
import type {Preset} from '@/components/affiliates/shared/RangePicker';
type Money={amount:string;currencyCode:string};
type Metric={state:string;currencies:{currency:string;amount:string}[]|null};
type Row={id:string;name:string;createdAt:string;status:string;test:boolean;orderTotal:Money|null;refunded:Money|null;discountCodes:string[];codeOwner?:{state:string;affiliateId?:string};categories:Record<string,Metric>|null;reason:string|null};
type Report={orders:Row[];categories:Record<string,Metric>;coverage:{reason:string|null;pagination:{complete:boolean}}};
const money=(m:Money|null)=>m?new Intl.NumberFormat('en-US',{style:'currency',currency:m.currencyCode}).format(Number(m.amount)):'—';
const amounts=(m:Metric|undefined)=>m?.state==='available'&&m.currencies?m.currencies.map(x=>money({amount:x.amount,currencyCode:x.currency})).join(' · ')||'No sales':'Unavailable';
export function ShopifyOrders({preset}:{preset:Preset}){
 const calendarDay=useCalendarDay();
 const [result,setResult]=useState<{key:string;data:Report|null;error:boolean}|null>(null);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();const range=resolveRange(preset);const params=new URLSearchParams({start:range.start.toISOString(),end:new Date(range.end.getTime()+1).toISOString()});
  fetch(`/api/affiliates/shopify-orders?${params}`,{credentials:'include',cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.orders)||!data.coverage?.pagination?.complete)throw Error();if(!controller.signal.aborted)setResult({key:preset,data,error:false});}).catch(()=>{if(!controller.signal.aborted)setResult({key:preset,data:null,error:true});});
  return()=>controller.abort();
 },[preset,attempt,calendarDay]);
 const current=result?.key===preset?result:null;
 if(!current)return <p role="status">Loading Shopify orders…</p>;
 if(current.error||!current.data)return <p role="alert">Shopify orders unavailable for this period. No zero-sales total has been assumed. <button onClick={()=>{setResult(null);setAttempt(x=>x+1);}} className="underline">Retry</button></p>;
 const data=current.data;
 return <section aria-label="Shopify orders" className="space-y-5 mb-8">
  <p className="text-sm opacity-70">IQON Daily · Shopify. Order-created dates in Eastern time. Merchandise excludes shipping and tax, includes all line refunds recorded so far, and counts paid/refunded non-test orders. These are store sales; discount use alone does not establish affiliate commission.</p>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[['supplements','Supplements merchandise'],['skincare','Skincare merchandise'],['unclassified','Unclassified merchandise']].map(([key,label])=><div key={key} className="glass-surface rounded-lg p-5"><p className="text-xs uppercase tracking-wide">{label}</p><p className="text-2xl mt-2">{amounts(data.categories[key])}</p></div>)}</div>
  {data.coverage.reason&&<p className="text-sm">{data.coverage.reason==='PERIOD_OPEN'?'Current period through this fetch.':'Merchandise summary unavailable for this period; order totals are shown separately.'}</p>}
  <p className="text-sm">{data.orders.length} Shopify orders · all payment statuses</p>
  {!data.orders.length?<p>No Shopify orders in this period.</p>:<div className="overflow-x-auto glass-surface rounded-lg"><table className="w-full text-sm text-left"><thead><tr>{['Shopify order','Created (Eastern)','Status','Order total incl. shipping/tax (before returns)','Refunded','Discount codes','Code owner'].map(x=><th className="p-4 font-medium" key={x}>{x}</th>)}</tr></thead><tbody>{data.orders.map(o=><tr key={o.id} className="border-t border-black/10"><td className="p-4 whitespace-nowrap">{o.name}<span className="block text-xs opacity-60">{o.id.split('/').pop()}</span></td><td className="p-4 whitespace-nowrap">{new Date(o.createdAt).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'})}</td><td className="p-4">{o.status.replaceAll('_',' ')}{o.test?' · TEST':''}</td><td className="p-4">{money(o.orderTotal)}</td><td className="p-4">{money(o.refunded)}</td><td className="p-4">{o.discountCodes.join(', ')||'None'}</td><td className="p-4">{o.codeOwner?.state==='verified'?<span className="block max-w-48 break-all">Affiliate {o.codeOwner.affiliateId}</span>:!o.discountCodes.length?'No code':o.codeOwner?.state==='ambiguous'?'Conflicting owners':'Owner unresolved'}</td></tr>)}</tbody></table></div>}
 </section>;
}
