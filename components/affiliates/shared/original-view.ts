/** Compatibility for the original presentation. Do not hide or combine currency buckets. */
export interface OriginalMoney { currency?: string | null; currencies?: {currency: string | null; [key:string]: unknown}[]; [key:string]: unknown }
export function originalCurrency(rows: readonly OriginalMoney[]): string | null {
 const keys=new Set(rows.flatMap(row=>row.currencies?row.currencies.map(b=>b.currency):[row.currency??null]));
 return keys.size===1&&keys.values().next().value?keys.values().next().value!:null;
}
export function originalMoney(value:number|null|undefined,currency:string|null='USD'):string {
 if(value==null||!Number.isFinite(value))return '—';
 if(!currency||currency==='UNKNOWN')return `${value.toFixed(2)} (currency unknown)`;
 if(!/^[A-Z]{3}$/.test(currency))return `${value.toFixed(2)} (currency unknown)`;
 return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(value);
}
export function originalField(row:OriginalMoney|null|undefined,field:string):string {
 if(!row)return '—';
 if(row.currencies){
  if(!row.currencies.length)return originalMoney(0);
  return row.currencies.map(b=>originalMoney(typeof b[field]==='number'?b[field] as number:null,b.currency)).join(' · ');
 }
 return originalMoney(typeof row[field]==='number'?row[field] as number:null,row.currency??null);
}
export function originalTotal(rows:readonly OriginalMoney[],field:string,divisor=1):string {
 if(!rows.length)return originalMoney(0);
 if(divisor<=0)return '—';
 const buckets=new Map<string|null,number|null>();
 for(const row of rows.flatMap<OriginalMoney>(r=>r.currencies??[r])){
  const currency=row.currency??null, value=row[field],previous=buckets.get(currency);
  buckets.set(currency,previous===null||typeof value!=='number'||!Number.isFinite(value)?null:(previous??0)+Math.round(value*100));
 }
 return [...buckets].map(([currency,cents])=>originalMoney(cents===null?null:cents/100/divisor,currency)).join(' · ');
}
export function originalChartRows<T extends {currency?:string|null}>(rows:T[]):T[]{
 return originalCurrency(rows as OriginalMoney[])?rows:[];
}
