"use client";

import {useEffect,useMemo,useState} from 'react';
import {ShoppingBag,DollarSign} from 'lucide-react';
import {StatCard,SectionTitle} from './ui';
import {useCalendarDay} from './useCalendarDay';
import {resolveRange,rangeLabel} from '@/lib/affiliates/time-series';

type Metric={state:'available'|'unavailable';reason:string|null;currencies:null|Array<{currency:string;amount:string}>;orderCount:number|null};
type Category={attributedRevenue:Metric;storeRevenue?:Metric};
type Report={version:1;provider:'shopify';period:{start:string;end:string;timezone:string};coverage?:{complete:boolean;reason:string|null;completeThrough?:string|null};categories:Record<'supplements'|'skincare'|'unclassified',Category>};
const categories=['supplements','skincare','unclassified'] as const;
const names={supplements:'Supplements',skincare:'Skincare',unclassified:'Unclassified'};
function metricValid(value:unknown):value is Metric {
 if(!value || typeof value!=='object')return false;
 const m=value as Metric;
 return (m.state==='available'||m.state==='unavailable') && (m.reason===null||typeof m.reason==='string') && (m.orderCount===null||Number.isSafeInteger(m.orderCount)&&m.orderCount>=0) && (m.state==='unavailable' ? m.currencies===null : Array.isArray(m.currencies)&&m.currencies.every(c=>/^[A-Z]{3}$/.test(c.currency)&&/^-?\d+(?:\.\d+)?$/.test(c.amount)));
}
function parseReport(value:unknown,start:string,end:string):Report {
 const r=value as Report;
 if(!r||r.version!==1||r.provider!=='shopify'||r.period?.start!==start||r.period?.end!==end||r.period?.timezone!=='America/New_York'||!categories.every(k=>metricValid(r.categories?.[k]?.attributedRevenue)&&(!r.categories[k].storeRevenue||metricValid(r.categories[k].storeRevenue)))) throw Error('Invalid category report');
 return r;
}
// Preserve exact canonical decimal strings and separate currency buckets. Never
// coerce to Number, add currencies or replace unknown/empty money with USD zero.
function valueOf(metric:Metric|undefined){
 if(!metric||metric.state!=='available')return 'Unavailable';
 if(!metric.currencies?.length)return metric.orderCount===0?'No matching orders':'No reported currency';
 return metric.currencies.map(c=>`${c.currency} ${c.amount}`).join(' · ');
}
function hintOf(metric:Metric|undefined,attributed:boolean){
 if(!metric||metric.state!=='available')return attributed?'Attribution unavailable':(metric?.reason?.replaceAll('_',' ').toLowerCase()??'Store reporting unavailable');
 return metric.orderCount===null?'Order count unavailable':`${metric.orderCount} matching orders · nonadditive across categories`;
}

/** Additive only: never contributes to the original Health totals or charts. */
export function CategoryRevenue({preset,audience}:{preset:string;audience:'admin'|'affiliate'}) {
 const day=useCalendarDay();
 const bounds=useMemo(()=>{const r=resolveRange(preset);return {start:r.start.toISOString(),end:new Date(r.end.getTime()+1).toISOString(),supported:r.end.getTime()+1-r.start.getTime()<=366*86400000}},[preset,day]);
 const key=`${bounds.start}/${bounds.end}/${audience}`;
 const [attempt,setAttempt]=useState(0);
 const [state,setState]=useState<{key:string;report?:Report;error?:string}>({key:''});
 useEffect(()=>{
  const controller=new AbortController();
  setState({key});
  if(!bounds.supported)return ()=>controller.abort();
  void (async()=>{try {
   const query=new URLSearchParams({start:bounds.start,end:bounds.end});
   const res=await fetch(`/api/affiliates/category-revenue?${query}`,{credentials:'include',cache:'no-store',signal:controller.signal});
   if(!res.ok)throw Error('Category reporting unavailable');
   const report=parseReport(await res.json(),bounds.start,bounds.end);
   if(!controller.signal.aborted)setState({key,report});
  }catch{if(!controller.signal.aborted)setState({key,error:'Category reporting unavailable. Original Overview figures are unchanged.'});}})();
  return ()=>controller.abort();
 },[key,bounds.start,bounds.end,bounds.supported,attempt]);
 const current=state.key===key?state:undefined;
 const report=current?.report;
 const loading=bounds.supported&&!report&&!current?.error;
 return <section aria-label="Body category revenue" className="mb-10" aria-busy={loading}>
  <SectionTitle eyebrow="IQON Body" title="Category revenue" right={<span className="text-[10px] uppercase tracking-[0.16em] font-sans text-[#64717a]">{rangeLabel(preset)}</span>}/>
  {!bounds.supported?<p className="text-sm text-[#64717a]">Choose a period of at most 366 days for category reporting.</p>:current?.error?<p role="alert" className="glass-surface rounded-lg px-5 py-3 text-sm text-[#20282c]">{current.error} <button className="underline" onClick={()=>setAttempt(n=>n+1)}>Retry categories</button></p>:<>
   <div className={`grid grid-cols-1 ${audience==='admin'?'md:grid-cols-2':'md:grid-cols-3'} gap-3 md:gap-4`}>
    {categories.map(k=><div key={k} className="contents">
     {audience==='admin'&&<StatCard icon={ShoppingBag} label={`${names[k]} store revenue`} value={loading?'—':valueOf(report?.categories[k].storeRevenue)} hint={loading?'Loading selected period…':hintOf(report?.categories[k].storeRevenue,false)}/>}
     <StatCard icon={DollarSign} label={`${names[k]} attributed revenue`} value={loading?'—':valueOf(report?.categories[k].attributedRevenue)} hint={loading?'Loading selected period…':hintOf(report?.categories[k].attributedRevenue,true)}/>
    </div>)}
   </div>
   {audience==='admin'&&report?.coverage&&!report.coverage.complete&&<p className="text-xs text-[#64717a] mt-3">Coverage: {report.coverage.reason?.replaceAll('_',' ').toLowerCase()??'incomplete'}{report.coverage.completeThrough?` · observed through ${report.coverage.completeThrough}`:''}.</p>}
  </>}
  <p className="text-xs text-[#64717a] mt-3">Order-created cohort · discounts and line refunds through fetch time. Not cash-flow revenue. Store sales are not affiliate commissions; these cards do not change the original Overview totals.</p>
 </section>;
}
