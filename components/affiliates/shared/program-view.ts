export interface ProgramRate { category: string; directRate: number; recurringRate: number; referralRate: number; customerDiscount: number; referralBase: 'revenue' | 'commission' }
export interface ProgramOrder { id: string; affiliateId: string; orderId: string; category: string; storeId: string | null; externalOrderId: string | null; lineItemId: string | null; matchType: string; commission: number; orderTotal: number; reportedRevenue?: number; currency: string; createdAt: string; paidAmount: number; outstandingAmount: number; adjustmentOfId: string | null }
export interface ProgramPayout { id: string; affiliateId: string; amount: number; currency: string; status: string; idempotencyKey?: string | null; method: string; reference: string | null; paidAt: string; reversedAt: string | null; reversedByWpUserId?: number | null; createdByWpUserId: number | null; items: { orderId: string; amount: number; category: string; currency?: string | null }[] }
export interface ProgramCurrency { currency: string; appCommission?: number; bonusCommission?: number; totalRevenue: number; totalOrders: number; totalCommission: number; directCommission: number; recurringCommission: number; referralCommission: number; adjustments: number; pendingCommission: number; paidCommission: number; totalPaidOut: number }
export interface ProgramReport { category: string; start: string | null; end: string | null; timezone: string; revenueSemantics: string; completeness: { unclassifiedEntries: number; missingCurrencyEntries: number; warnings: string[] }; currencies: ProgramCurrency[]; orders: ProgramOrder[]; payouts: ProgramPayout[]; rates?: ProgramRate[]; stores?: StoreActivation[]; crossStoreActive?: boolean }

export function affiliateComparison(orders: ProgramOrder[], payouts: ProgramPayout[]) {
  const groups=new Map<string,{affiliateId:string;currency:string;orderKeys:Set<string>;sales:number;earnings:number;pending:number;paid:number;payouts:number}>();
  const get=(affiliateId:string,currency:string)=>{const key=JSON.stringify([affiliateId,currency]);let row=groups.get(key);if(!row){row={affiliateId,currency,orderKeys:new Set(),sales:0,earnings:0,pending:0,paid:0,payouts:0};groups.set(key,row);}return row;};
  for(const o of orders){const row=get(o.affiliateId,o.currency??'UNKNOWN');row.earnings+=Math.round(o.commission*100);row.pending+=Math.round(o.outstandingAmount*100);row.paid+=Math.round(o.paidAmount*100);
    if(['code','recurring'].includes(o.matchType)||(o.matchType==='app'&&o.storeId?.startsWith('revenuecat:'))){row.sales+=Math.round((o.reportedRevenue??o.orderTotal)*100);if(!o.adjustmentOfId)row.orderKeys.add(JSON.stringify([o.storeId??'legacy',o.externalOrderId??o.orderId]));}
  }
  for(const p of payouts)if(p.status==='completed')for(const item of p.items)get(p.affiliateId,item.currency??p.currency??'UNKNOWN').payouts+=Math.round(item.amount*100);
  return [...groups.values()].map(r=>({affiliateId:r.affiliateId,currency:r.currency,orders:r.orderKeys.size,sales:r.sales/100,earnings:r.earnings/100,pending:r.pending/100,paid:r.paid/100,payouts:r.payouts/100})).sort((a,b)=>a.affiliateId.localeCompare(b.affiliateId)||a.currency.localeCompare(b.currency));
}
export function selectProgramCurrency(report: ProgramReport | null, currency: string) {
  const currencies = report?.currencies.filter(b => currency === 'all' || b.currency === currency) ?? [];
  const orders = report?.orders.filter(o => currency === 'all' || (o.currency ?? 'UNKNOWN') === currency) ?? [];
  const payouts = report?.payouts.map(p => ({ ...p, items: p.items.filter(i => currency === 'all' || (i.currency ?? p.currency ?? 'UNKNOWN') === currency) })).filter(p => currency === 'all' || p.items.length > 0) ?? [];
  return { currencies, orders, payouts };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function earningsSeries(rows: { createdAt: string; commission: number }[]) {
  const buckets = new Map<string, number>();
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  for (const row of rows) {
    const day = fmt.format(new Date(row.createdAt));
    buckets.set(day, (buckets.get(day) ?? 0) + row.commission);
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => ({ day, amount }));
}
type SettlementRow = { id: string; affiliateId: string; currency: string; outstandingAmount: number };
export function validateAllocations(rows: SettlementRow[], draft: Record<string, string>, affiliateId: string) {
  const currencies = new Set<string>();
  const result = Object.entries(draft).filter(([, value]) => value !== '').map(([orderId, value]) => {
    const row = rows.find(r => r.id === orderId);
    const amount = Number(value);
    if (!row || row.affiliateId !== affiliateId || !Number.isFinite(amount) || amount === 0 || !/^-?\d+(\.\d{1,2})?$/.test(value)) throw new Error('Use a nonzero exact-cent allocation belonging to this affiliate.');
    const owed = Math.round(row.outstandingAmount * 100), allocated = Math.round(amount * 100);
    if (owed < 0 ? allocated !== owed : allocated < 0 || allocated > owed) throw new Error('Positive allocations cannot exceed outstanding earnings; negative adjustments must be netted in full.');
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error('Currency must be classified before payment.');
    currencies.add(row.currency);
    return { orderId, amount };
  });
  if (!result.length) throw new Error('Enter at least one allocation.');
  if (currencies.size !== 1) throw new Error('Record each currency separately.');
  const currency = [...currencies][0];
  if (rows.some(r => r.affiliateId === affiliateId && r.currency === currency && r.outstandingAmount < 0 && !result.some(a => a.orderId === r.id))) throw new Error('All outstanding negative adjustments in this currency must be included, including other dates/categories.');
  if (result.reduce((sum,a) => sum + Math.round(a.amount * 100),0) <= 0) throw new Error('The net payment after required adjustments must be positive.');
  return result;
}
export function settlementPlan(allRows: SettlementRow[], positiveDraft: Record<string,string>, affiliateId: string) {
  const selected = Object.entries(positiveDraft).filter(([,v])=>v !== '');
  const currencies = new Set(selected.map(([id])=>allRows.find(r=>r.id===id)?.currency));
  if (currencies.size !== 1 || currencies.has(undefined)) throw new Error('Select positive earnings in one currency.');
  const currency = [...currencies][0]!;
  if (selected.some(([id,value]) => Number(value) <= 0 || !allRows.some(r=>r.id===id&&r.affiliateId===affiliateId&&r.outstandingAmount>0))) throw new Error('Choose positive earnings; mandatory negative adjustments are added automatically.');
  const draft = {...positiveDraft};
  for (const row of allRows) if (row.affiliateId===affiliateId && row.currency===currency && row.outstandingAmount<0) draft[row.id]=row.outstandingAmount.toFixed(2);
  const allocations=validateAllocations(allRows,draft,affiliateId);
  return {currency,amount:allocations.reduce((s,a)=>s+Math.round(a.amount*100),0)/100,allocations};
}
export function payoutAttemptDisposition(httpStatus: number | undefined, lookupSucceeded: boolean, found: boolean): 'recorded' | 'correctable' | 'uncertain' {
  if (lookupSucceeded && found) return 'recorded';
  return lookupSucceeded && (httpStatus === 400 || httpStatus === 422) ? 'correctable' : 'uncertain';
}
export interface StoreActivation { storeId:string; code:string|null; status:string; reason?:string; verifiedAt:string|null; expectedDiscounts?:{peptides:number|null;supplements:number|null;skincare:number|null} }
export function approvalAgreements(rates: ProgramRate[]) {
  for(const category of ['peptides','supplements','skincare','app']) {
    const rate=rates.find(r=>r.category===category);
    if(!rate || !['revenue','commission'].includes(rate.referralBase) || [rate.directRate,rate.recurringRate,rate.referralRate,rate.customerDiscount].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)) throw new Error('Save explicit direct, recurring, referral, buyer discount and referral-base agreements for Peptides, Supplements, Skincare and App before approval. Zero is valid.');
  }
  return rates.find(r=>r.category==='peptides')!;
}
export function currentCrossStoreActive(stores: StoreActivation[], canonicalActive: boolean) {
  return canonicalActive && ['woo-health','shopify-supplements'].every(id => stores.some(s => s.storeId === id && s.status === 'active' && !!s.verifiedAt && !!s.code)) && new Set(stores.map(s=>s.code)).size === 1;
}

export const PROGRAM_CATEGORIES = ['all', 'peptides', 'supplements', 'skincare', 'app', 'unclassified'] as const;
export type ProgramCategory = typeof PROGRAM_CATEGORIES[number];
export interface ProgramFilters { category: ProgramCategory; start: string; end: string; affiliateId?: string }

/** Convert a business calendar day, not the viewer's local timezone, to an inclusive instant. */
export function businessDayInstant(day: string, end: boolean): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error('Invalid reporting date');
  if (end) date.setUTCDate(date.getUTCDate() + 1);
  const target = date.getTime();
  let guess = target;
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map(p => [p.type, p.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    guess += target - represented;
  }
  return new Date(guess - (end ? 1 : 0)).toISOString();
}
export function programQuery(filters: ProgramFilters): string {
  if (filters.start && filters.end && filters.start > filters.end) throw new Error('Start date must precede end date');
  const query = new URLSearchParams({ category: filters.category });
  if (filters.start) query.set('start', businessDayInstant(filters.start, false));
  if (filters.end) query.set('end', businessDayInstant(filters.end, true));
  if (filters.affiliateId) query.set('affiliateId', filters.affiliateId);
  return query.toString();
}
