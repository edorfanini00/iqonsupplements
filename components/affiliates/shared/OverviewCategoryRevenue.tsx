"use client";
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { StatCard } from './ui';
import { originalMoney } from './original-view';
import { requestProgram } from './program-api';
import { resolveRange } from '@/lib/affiliates/time-series';
import { useCalendarDay } from './useCalendarDay';
import type { ProgramOrder } from './program-view';

/** New attributed figures only. Historical orderTotal and business revenue are untouched. */
export function categoryRevenue(orders: ProgramOrder[], category: string) {
  const buckets=new Map<string|null,number|null>();
  for(const order of orders) {
    if(order.category!==category || !['code','recurring'].includes(order.matchType)) continue;
    const currency=order.currency && order.currency!=='UNKNOWN'?order.currency:null;
    const amount=order.reportedRevenue;
    const previous=buckets.get(currency);
    buckets.set(currency, previous===null || typeof amount!=='number' || !Number.isFinite(amount) ? null : (previous??0)+Math.round(amount*100));
  }
  return [...buckets].map(([currency,cents])=>({currency,amount:cents===null?null:cents/100}));
}
export function OverviewCategoryRevenue({admin=false,preset}:{admin?:boolean;preset:string}) {
  const [orders,setOrders]=useState<ProgramOrder[]|null>(null);
  const [error,setError]=useState('');
  const day=useCalendarDay();
  useEffect(()=>{
    let alive=true;setError('');setOrders(null);
    const range=resolveRange(preset);
    const query=new URLSearchParams({category:'all',start:range.start.toISOString(),end:range.end.toISOString()});
    void requestProgram(`/api/affiliates/${admin?'admin/':''}program?${query}`).then(data=>{
      if(!data.report || !Array.isArray(data.report.orders))throw new Error('Attributed revenue unavailable');
      if(alive)setOrders(data.report.orders);
    }).catch(()=>{if(alive)setError('Attributed revenue unavailable');});
    return()=>{alive=false;};
  },[admin,preset,day]);
  return <>{['supplements','skincare'].map(category=>{
    const buckets=orders?categoryRevenue(orders,category):[];
    return <StatCard key={category} icon={ShoppingBag} label={category==='supplements'?'Supplements':'Skincare'}
      value={buckets.length?buckets.map(b=>originalMoney(b.amount,b.currency)).join(' · '):'—'}
      hint={error || (!orders?'Loading attributed revenue…':!buckets.length?'No attributed orders':'Attributed revenue (net)')} />;
  })}</>;
}
