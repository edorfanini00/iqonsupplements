"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader, StatCard } from './ui';
import { requestProgram as request } from './program-api';
import { SharedPayoutForm as PayoutForm } from './SharedPayoutForm';
import { PROGRAM_CATEGORIES, programQuery, earningsSeries, csvCell, selectProgramCurrency, affiliateComparison, currentCrossStoreActive, type StoreActivation, type ProgramCategory, type ProgramReport, type ProgramRate, type ProgramOrder } from './program-view';

const control = 'glass-surface rounded-xl px-3 py-2 text-sm border border-current/10';
const button = `${control} disabled:opacity-40 disabled:cursor-not-allowed`;
const money = (value: number, currency: string) => /^[A-Z]{3}$/.test(currency) ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value) : `${value.toFixed(2)} (currency unknown)`;
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One canonical report is the only input to all financial surfaces. Never merge currencies. */
export function SharedProgram({ admin = false, affiliateId: fixedAffiliate, brand = 'health', title }: { admin?: boolean; affiliateId?: string; brand?: 'health' | 'supplements'; title?: string }) {
  const [category, setCategory] = useState<ProgramCategory>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [affiliateId, setAffiliateId] = useState(fixedAffiliate ?? '');
  const [currency, setCurrency] = useState('all');
  const [ready, setReady] = useState(false);
  const [report, setReport] = useState<ProgramReport | null>(null);
  const [people, setPeople] = useState<{ id: string; firstName: string; lastName: string; promoCode: string }[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('');
  const sequence = useRef(0);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [reversing, setReversing] = useState(false);
  const storageKey = `iqon-program-filters:${admin ? 'admin' : 'affiliate'}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (PROGRAM_CATEGORIES.includes(saved.category)) setCategory(saved.category);
      if (typeof saved.start === 'string') setStart(saved.start);
      if (typeof saved.end === 'string') setEnd(saved.end);
      if (!fixedAffiliate && admin && typeof saved.affiliateId === 'string') setAffiliateId(saved.affiliateId);
      if (typeof saved.currency === 'string') setCurrency(saved.currency);
    } catch { /* Storage can be unavailable; server authority is unaffected. */ }
    setReady(true);
  }, [storageKey, fixedAffiliate, admin]);
  useEffect(() => { if (fixedAffiliate) setAffiliateId(fixedAffiliate); }, [fixedAffiliate]);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ category, start, end, affiliateId, currency })); } catch { /* Non-essential preference. */ }
  }, [ready, storageKey, category, start, end, affiliateId, currency]);
  useEffect(() => {
    if (!admin) return;
    request('/api/affiliates/admin/affiliates').then(d => setPeople(d.affiliates ?? [])).catch(e => setError(e.message));
  }, [admin]);

  const load = useCallback(async () => {
    const current = ++sequence.current;
    setRefreshing(true);
    try {
      const query = programQuery({ category, start, end, affiliateId: admin ? affiliateId : undefined });
      const data = await request(`/api/affiliates/${admin ? 'admin/' : ''}program?${query}`);
      if (!data.report || !Array.isArray(data.report.currencies) || !Array.isArray(data.report.orders)) throw new Error('Shared report is unavailable.');
      const normalized: ProgramReport = { ...data.report, rates: data.rates ?? data.report.rates, stores: data.stores ?? [], crossStoreActive: data.crossStoreActive === true, orders: data.report.orders.map((o: ProgramOrder) => ({...o, currency: o.currency ?? 'UNKNOWN'})), payouts: data.report.payouts.map((p: ProgramReport['payouts'][number]) => ({...p, currency: p.currency ?? 'UNKNOWN'})) };
      if (current === sequence.current) { setReport(normalized); setError(''); setUpdated(new Date().toLocaleTimeString()); }
      return normalized;
    } catch (e) {
      if (current === sequence.current) { setError(e instanceof Error ? e.message : 'Could not refresh.'); setReport(null); }
      throw e;
    } finally { if (current === sequence.current) setRefreshing(false); }
  }, [admin, affiliateId, category, start, end]);
  useEffect(() => {
    if (!ready) return;
    setReport(null); setPayoutOpen(false);
    const refresh = () => { if (document.visibilityState === 'visible') void load().catch(() => {}); };
    void load().catch(() => {});
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh); window.addEventListener('iqon-program-refresh', refresh);
    return () => { ++sequence.current; clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('iqon-program-refresh', refresh); };
  }, [ready, load]);

  const { currencies: buckets, orders, payouts } = selectProgramCurrency(report, currency);
  const comparison = affiliateComparison(orders, payouts);
  function exportReport() {
    if (!report) return;
    download(`iqon-program-${category}.json`, JSON.stringify({ ...report, currencyFilter: currency, affiliateComparison: comparison, currencies: buckets, orders, payouts }, null, 2), 'application/json');
  }
  function exportEntries() {
    const columns = ['id', 'affiliateId', 'orderId', 'category', 'storeId', 'externalOrderId', 'lineItemId', 'matchType', 'currency', 'createdAt', 'orderTotal', 'commission', 'paidAmount', 'outstandingAmount', 'adjustmentOfId', 'reportedRevenue'] as const;
    const metadata = [['category', category], ['start', report?.start ?? 'lifetime'], ['end', report?.end ?? 'lifetime'], ['currency', currency], ['timezone', 'America/New_York'], ['revenue semantics', report?.revenueSemantics ?? ''], ['orderTotal semantics', 'Raw historical recorded base, including original Woo gross shipping/tax; signed adjustments remain unchanged. Not the net reporting total.'], ['reportedRevenue semantics', 'Canonical per-entry reporting basis from the report: net commerce, snapshot-basis verified app, recorded legacy revenue. Missing stays blank; never inferred from gross.'], ['revenue aggregation', 'Per currency, sum reportedRevenue for code/recurring entries and app entries with storeId starting revenuecat:, including signed adjustments. Exclude referral and bonus bases; they can repeat sales. Do not add currencies. Unique order counts (not revenue lines) deduplicate non-adjustments by storeId + externalOrderId (legacy fallback: orderId).']];
    download(`iqon-entries-${category}.csv`, [...metadata.map(r => r.map(csvCell).join(',')), columns.map(csvCell).join(','), ...orders.map(o => columns.map(k => csvCell(o[k])).join(','))].join('\r\n'), 'text/csv;charset=utf-8');
  }
  async function reverse(id: string) {
    if (reversing || !window.confirm('Reverse this recorded payout with an audit trail? This does NOT retrieve money from the recipient. Outstanding balances will reopen.')) return;
    setReversing(true); setNotice('');
    try {
      await request(`/api/affiliates/admin/payouts/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const next = await load();
      const changed = next.payouts.find(p => p.id === id);
      if (!changed || (!changed.reversedAt && changed.status !== 'reversed')) throw new Error('Reversal submitted; audit readback not yet confirmed. Refresh before retrying.');
      setNotice('Reversal confirmed in the shared ledger. No bank transaction was performed.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Reversal failed.'); }
    finally { setReversing(false); }
  }

  return <section className="space-y-6 mb-10" aria-label="Shared affiliate program">
    <PageHeader eyebrow="One IQON partnership" title={title ?? (admin ? 'Shared program overview' : 'Your performance')} description="Peptides, supplements, skincare and IQONIC app — one authoritative commission ledger." />
    <div className="glass-surface rounded-lg p-4 flex flex-wrap gap-3 items-end">
      <label className="text-xs grid gap-1">Category<select aria-label="Category" className={control} value={category} onChange={e => setCategory(e.target.value as ProgramCategory)}>{PROGRAM_CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All categories' : c[0].toUpperCase() + c.slice(1)}</option>)}</select></label>
      <label className="text-xs grid gap-1">From (New York)<input aria-label="From date" className={control} type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
      <label className="text-xs grid gap-1">Through (New York)<input aria-label="Through date" className={control} type="date" value={end} min={start} onChange={e => setEnd(e.target.value)} /></label>
      <button className={button} onClick={() => { setStart(''); setEnd(''); }}>Lifetime</button>
      {admin && <label className="text-xs grid gap-1 max-w-full">Affiliate<select className={`${control} max-w-full`} aria-label="Selected affiliate" disabled={!!fixedAffiliate} value={affiliateId} onChange={e => setAffiliateId(e.target.value)}><option value="">All affiliates</option>{fixedAffiliate && !people.some(p => p.id === fixedAffiliate) && <option value={fixedAffiliate}>{fixedAffiliate}</option>}{people.map(p => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} · {p.promoCode}</option>)}</select></label>}
      <label className="text-xs grid gap-1">Currency<select className={control} value={currency} onChange={e => setCurrency(e.target.value)}><option value="all">All (separate totals)</option>{report?.currencies.map(c => <option key={c.currency}>{c.currency}</option>)}{currency !== 'all' && !report?.currencies.some(c => c.currency === currency) && <option>{currency}</option>}</select></label>
      <button className={button} disabled={refreshing} onClick={() => void load().catch(() => {})}>Refresh</button>
      <button className={button} disabled={!report} onClick={exportReport}>Export report</button>
      <button className={button} disabled={!report} onClick={exportEntries}>Export entries CSV</button>
    </div>
    <p className="text-xs text-[#64717a]" role="status">{refreshing ? 'Refreshing shared records…' : updated ? `Updated ${updated} · refreshes every 15 seconds and when you return; no login required.` : 'Loading shared records…'} Date/category/affiliate/currency selection applies to every card, chart, ledger table and export below. Blank dates mean lifetime.</p>
    {error && <div role="alert" className="border border-amber-500/50 rounded-xl p-4">{error} <button className="underline" onClick={() => void load().catch(() => {})}>Retry</button></div>}
    {notice && <p role="status" className="glass-surface rounded-xl p-4">{notice}</p>}
    {!admin && <StoreActivationStatus stores={report?.stores ?? []} canonicalActive={report?.crossStoreActive ?? false} brand={brand} />}
    {report && <>
      <div className="text-sm space-y-2">
        <p><strong>Affiliate-attributed sales, not total business revenue.</strong> {report.revenueSemantics}</p>
        {admin && <p>Total business revenue: unavailable in this ledger report. Do not use affiliate-attributed sales as business-wide sales. <Link className="underline" href="/affiliates/admin/orders">Store-wide order operations</Link> and <Link className="underline" href="/affiliates/admin/app">app business metrics</Link> remain available in their source-specific views.</p>}
        <p>Unique orders count once within each currency when All is selected. Category order counts can overlap on mixed orders and must not be added. Ledger rows include separate line items, referral earnings and adjustments; row count is not order count.</p>
      </div>
      <aside className="border border-amber-500/40 rounded-lg p-4 text-sm" aria-label="Reporting completeness">
        <strong>Integration and currency checks</strong>
        <p>Unclassified entries: {report.completeness.unclassifiedEntries}. Missing-currency entries: {report.completeness.missingCurrencyEntries}. Currencies are never converted or added together.</p>
        <p>Recorded ledger data does not prove all integrations have completed ingestion. Missing records are not evidence of zero sales.</p>
        {report.completeness.warnings.map((w, i) => <p key={i}>{w}</p>)}
      </aside>
      {!buckets.length && <p className="glass-surface rounded-lg p-6">No recorded entries for this selection. This is not confirmation of integration completeness.</p>}
      {buckets.map(b => <section key={b.currency} className="space-y-4" aria-label={`${b.currency} metrics`}>
        <h2 className="text-xl font-medium">{b.currency} · {category === 'all' ? 'All categories' : category}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard label="Attributed sales" value={money(b.totalRevenue, b.currency)} hint="Not commission earnings" accent />
          <StatCard label="Unique orders" value={String(b.totalOrders)} hint="Mixed orders deduplicated by source" />
          <StatCard label="Total earnings" value={money(b.totalCommission, b.currency)} hint="Includes adjustments and bonuses" />
          <StatCard label="Outstanding earnings" value={money(b.pendingCommission, b.currency)} hint="Selected earning dates" />
          <StatCard label="Direct earnings" value={money(b.directCommission, b.currency)} />
          <StatCard label="Recurring earnings" value={money(b.recurringCommission, b.currency)} />
          <StatCard label="Referral earnings" value={money(b.referralCommission, b.currency)} hint="Paid to the referrer beneficiary" />
          <StatCard label="App earnings" value={b.appCommission == null ? "Unavailable" : money(b.appCommission, b.currency)} hint="Existing IQONIC integration" />
          <StatCard label="Bonus earnings" value={b.bonusCommission == null ? "Unavailable" : money(b.bonusCommission, b.currency)} />
          <StatCard label="Adjustments" value={money(b.adjustments, b.currency)} />
          <StatCard label="Settled earnings" value={money(b.paidCommission, b.currency)} hint="Allocations against selected entries" />
          <StatCard label="Completed payout allocations" value={money(b.totalPaidOut, b.currency)} hint="Payout completion date in range" />
        </div>
        <EarningsChart orders={orders.filter(o => o.currency === b.currency)} currency={b.currency} />
      </section>)}
      {admin && <section className="space-y-3"><h2 className="text-xl font-medium">Affiliate comparison · current report selection</h2><p className="text-xs">Each row uses the same category, dates and currency selection as the cards and exported report. No recorded activity is not proof of a complete integration. Select an affiliate without losing the reporting range.</p><div className="glass-surface rounded-lg overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr>{['Affiliate','Currency','Unique orders','Attributed sales','Earnings','Outstanding','Settled earnings','Completed payout allocations'].map(h=><th className="p-3 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{comparison.map(r=>{const person=people.find(p=>p.id===r.affiliateId);return <tr className="border-t border-current/10" key={`${r.affiliateId}:${r.currency}`}><td className="p-3"><button disabled={!!fixedAffiliate} className="underline" onClick={()=>setAffiliateId(r.affiliateId)}>{person?`${person.firstName} ${person.lastName} · ${person.promoCode}`:r.affiliateId}</button></td><td className="p-3">{r.currency}</td><td className="p-3">{r.orders}</td>{[r.sales,r.earnings,r.pending,r.paid,r.payouts].map((amount,i)=><td key={i} className="p-3">{money(amount,r.currency)}</td>)}</tr>;})}</tbody></table>{!comparison.length&&<p className="p-5">No recorded affiliate activity in this selection.</p>}</div></section>}
      <div className="flex flex-wrap gap-3 items-center">
        <h2 className="text-xl font-medium">Commission entries</h2>
        {admin && affiliateId && <><Link className="underline text-sm" href={`/affiliates/admin/affiliates/${encodeURIComponent(affiliateId)}`}>Profile & network</Link><button className={button} onClick={() => setPayoutOpen(v => !v)}>Record payment already made</button></>}
        {admin && !affiliateId && <p className="text-sm">Select an affiliate to record a payment or edit category agreements.</p>}
      </div>
      {payoutOpen && <PayoutForm key={`${affiliateId}:${category}:${start}:${end}:${currency}`} affiliateId={affiliateId} orders={orders} refresh={load} onDone={() => { setPayoutOpen(false); setNotice('Payment record read back from the shared ledger. No money was transferred.'); }} />}
      <div className="glass-surface rounded-lg overflow-x-auto"><table className="w-full text-sm min-w-[820px]"><thead><tr>{['Entry / source order', 'Category', 'Type / adjustment', 'Created (New York)', 'Currency', 'Recorded sales base', 'Earnings', 'Allocated paid', 'Outstanding'].map(h => <th key={h} className="text-left p-3 text-xs font-sans">{h}</th>)}</tr></thead><tbody>{orders.map(o => <tr key={o.id} className="border-t border-current/10"><td className="p-3"><span className="block font-sans text-xs">{o.orderId}</span><small>{o.storeId ?? 'Legacy source'} · {o.lineItemId ?? o.id}</small></td><td className="p-3">{o.category}</td><td className="p-3">{o.matchType}{o.adjustmentOfId && <small className="block">Correction of {o.adjustmentOfId}</small>}</td><td className="p-3">{new Date(o.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td className="p-3">{o.currency}</td><td className="p-3">{money(o.reportedRevenue ?? o.orderTotal, o.currency)}</td><td className="p-3">{money(o.commission, o.currency)}</td><td className="p-3">{money(o.paidAmount, o.currency)}</td><td className="p-3">{money(o.outstandingAmount, o.currency)}</td></tr>)}</tbody></table>{!orders.length && <p className="p-5">No entries for this selection.</p>}</div>
      <p className="text-xs">Recorded sales bases can repeat for referral entries. Use the deduplicated attributed-sales cards, not the sum of ledger sales bases.</p>
      <h2 className="text-xl font-medium">Payout audit trail</h2>
      <p className="text-sm">Recording a payout confirms payment already made elsewhere; it never sends a bank transfer. Reversal changes the ledger, not the bank transaction. Date filters use payout completion time for this table.</p>
      <div className="glass-surface rounded-lg overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr>{['Payment / status', 'Completed (New York)', 'Method / reference', 'Recorded by', 'Selected allocations', 'Reversal'].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr></thead><tbody>{payouts.map(p => <tr key={p.id} className="border-t border-current/10"><td className="p-3 font-sans text-xs">{p.id}<span className="block">{p.status} · {money(p.amount, p.currency)} total payment</span></td><td className="p-3">{new Date(p.paidAt).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td><td className="p-3">{p.method}<span className="block">{p.reference || 'No reference recorded'}</span></td><td className="p-3">{p.createdByWpUserId ?? 'Legacy — actor not recorded'}</td><td className="p-3">{p.items.map((item, i) => <div key={`${item.orderId}:${i}`}>{item.category}: {money(item.amount, item.currency ?? p.currency)} <small>({item.orderId})</small></div>)}</td><td className="p-3">{p.reversedAt ? `Audited reversal ${new Date(p.reversedAt).toLocaleString('en-US', {timeZone:'America/New_York'})} by ${p.reversedByWpUserId ?? 'legacy actor not recorded'}` : admin ? <button disabled={reversing} className={button} onClick={() => void reverse(p.id)}>Reverse record</button> : '—'}</td></tr>)}</tbody></table>{!payouts.length && <p className="p-5">No recorded payouts for this selection.</p>}</div>
      {admin && affiliateId && <CodeVerification key={affiliateId} affiliateId={affiliateId} brand={brand} />}
      <ProgramRates key={affiliateId || "self"} admin={admin} affiliateId={affiliateId} rates={admin ? undefined : report.rates} />
      <p className="text-sm"><Link className="underline" href={admin ? '/affiliates/admin/app' : '/affiliates/dashboard/clients'}>{admin ? 'Open the existing IQONIC app integration' : 'View your linked clients'}</Link> · App is the existing shared IQONIC integration, not a new app project.</p>
    </>}
  </section>;
}

function EarningsChart({ orders, currency }: { orders: ProgramOrder[]; currency: string }) {
  const points = earningsSeries(orders);
  const maximum = Math.max(1, ...points.map(p => Math.abs(p.amount)));
  return <div className="glass-surface rounded-lg p-5"><h3 className="font-medium">Earnings by New York business day</h3><p className="text-xs mb-4">Includes negative adjustments; not sales revenue. {currency}</p><div className="max-h-64 overflow-auto space-y-2" role="img" aria-label={`Daily earnings in ${currency}`}>{points.map(p => <div className="grid grid-cols-[6rem_1fr_6rem] gap-3 items-center text-xs" key={p.day}><span>{p.day}</span><div className="bg-current/5 rounded h-3"><div className={`h-3 rounded ${p.amount < 0 ? 'bg-amber-600' : 'bg-[#20282c]'}`} style={{ width: `${Math.abs(p.amount) / maximum * 100}%` }} /></div><span className="text-right">{money(p.amount, currency)}</span></div>)}{!points.length && <p>No recorded earnings in this selection.</p>}</div></div>;
}

export function StoreActivationStatus({stores,canonicalActive,brand}:{stores:StoreActivation[];canonicalActive:boolean;brand:'health'|'supplements'}) {
  const active=currentCrossStoreActive(stores,canonicalActive);
  return <section className="glass-surface rounded-lg p-5 space-y-3" aria-label="Store activation">
    <h2 className="font-medium">{brand==='supplements'?'Your IQON partnership goes further.':'More ways to share IQON.'}</h2>
    {active ? <p className="text-sm">{brand==='supplements'?'Use your creator code on IQON Health’s peptide collection, and track your sales, commissions, and app performance together here.':'Use your creator code across our supplements and skincare collection, with all your sales, commissions, and app performance in one place.'} <a className="underline" href={brand==='supplements'?'https://www.iqonhealth.com':'https://www.iqonbody.com'} target="_blank" rel="noopener noreferrer">Visit the verified partner store</a></p> : <p className="text-sm">Track your sales, commissions and app performance together here. Cross-store activation is not yet verified for every current agreement. Do not advertise another store until its activation is confirmed.</p>}
    {['woo-health','shopify-supplements'].map(id=>{const s=stores.find(x=>x.storeId===id);return <div key={id} className="text-sm border-t border-current/10 pt-2"><strong>{id==='woo-health'?'IQON Health · Peptides':'IQON Body · Supplements & skincare'} — {s?.status??'unconfigured'}</strong><p>{s?.reason??'No current provider verification available.'}</p><p>Code: {s?.code??'Not available'} · Verified: {s?.verifiedAt?new Date(s.verifiedAt).toLocaleString():'Not verified'}</p></div>;})}
    <p className="text-xs">Verification is point-in-time and must be renewed after code, discount or store configuration changes.</p>
  </section>;
}

function CodeVerification({ affiliateId, brand }: { affiliateId: string; brand: 'health' | 'supplements' }) {
  const [states, setStates] = useState<StoreActivation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setStates([]); setError(''); const invalidate = () => setStates([]); window.addEventListener('iqon-code-invalidated', invalidate); return () => window.removeEventListener('iqon-code-invalidated', invalidate); }, [affiliateId]);
  async function verify() {
    setBusy(true); setStates([]); setError('');
    try {
      const data = await request('/api/affiliates/admin/code-sync', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({affiliateId,mutate:false})});
      setStates(data.results ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Verification unavailable.'); }
    finally { setBusy(false); }
  }
  const active = ['woo-health','shopify-supplements'].every(id => states.some(s => s.storeId === id && s.status === 'active' && !!s.verifiedAt)) && new Set(states.map(s => s.code)).size === 1;
  return <section className="glass-surface rounded-lg p-5 space-y-3"><h2 className="text-xl font-medium">Store-by-store creator-code activation</h2><p className="text-sm">Verification reads the real providers and persists their readback. It does not create a code or change a discount. Approval alone never means a store is active. Results are point-in-time; verify again after changing any agreement.</p><button className={button} disabled={busy} onClick={() => void verify()}>{busy ? 'Verifying stores…' : 'Verify current store activation'}</button>{error && <p role="alert">{error}</p>}{states.map(s => <div key={s.storeId} className="text-sm border-t border-current/10 pt-3"><strong>{s.storeId} · {s.status}</strong><p>{s.code} · {s.reason ?? 'Provider readback matched.'}</p><p>Verified: {s.verifiedAt ? new Date(s.verifiedAt).toLocaleString() : 'Not verified'}</p>{s.expectedDiscounts && <p>Agreed buyer discount: peptides {s.expectedDiscounts.peptides ?? 'unset'}%, supplements {s.expectedDiscounts.supplements ?? 'unset'}%, skincare {s.expectedDiscounts.skincare ?? 'unset'}%.</p>}</div>)}{active ? <p className="text-sm">{brand === 'supplements' ? 'Your IQON partnership goes further. Use your creator code on IQON Health’s peptide collection, and track your sales, commissions, and app performance together here.' : 'More ways to share IQON. Use your creator code across our supplements and skincare collection, with all your sales, commissions, and app performance in one place.'} <a className="underline" href={brand === 'supplements' ? 'https://www.iqonhealth.com' : 'https://www.iqonbody.com'} target="_blank" rel="noopener noreferrer">Visit the verified partner store</a></p> : <p className="text-sm">Cross-store usage is not advertised until both stores return matching active codes with verified readback.</p>}</section>;
}

export function ProgramRates({ admin, affiliateId, rates, onRatesChange }: { admin: boolean; affiliateId: string; rates?: ProgramRate[]; onRatesChange?: (rates: ProgramRate[]) => void }) {
  const [saved, setSaved] = useState<ProgramRate[]>(rates ?? []);
  useEffect(() => { onRatesChange?.(saved); }, [saved, onRatesChange]);
  const [category, setCategory] = useState('peptides');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [base, setBase] = useState<'revenue' | 'commission'>('revenue');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const fields = ['directRate', 'recurringRate', 'referralRate', 'customerDiscount'] as const;
  const read = useCallback(async () => {
    if (admin && affiliateId) { const data = await request(`/api/affiliates/admin/rates?affiliateId=${encodeURIComponent(affiliateId)}`); setSaved(data.rates ?? []); return data.rates as ProgramRate[]; }
    setSaved(rates ?? []); return rates ?? [];
  }, [admin, affiliateId, rates]);
  useEffect(() => { setNotice(''); void read().catch(e => setNotice(e.message)); }, [read]);
  useEffect(() => { const rate = saved.find(r => r.category === category); setDraft(Object.fromEntries(fields.map(k => [k, rate ? String(rate[k]) : '']))); setBase(rate?.referralBase ?? 'revenue'); }, [saved, category]); // Zero is an agreement, never a fallback.
  async function save() {
    setBusy(true); setNotice('');
    try {
      const values = Object.fromEntries(fields.map(k => { const n = Number(draft[k]); if (draft[k]?.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) throw new Error('Enter all percentages from 0 to 100. Zero is valid.'); return [k, n]; }));
      await request('/api/affiliates/admin/rates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliateId, category, ...values, referralBase: base }) });
      const readback = await read();
      const actual = readback.find(r => r.category === category);
      if (!actual || fields.some(k => actual[k] !== values[k]) || actual.referralBase !== base) throw new Error('Saved request was not confirmed on readback.');
      window.dispatchEvent(new Event('iqon-code-invalidated'));
      setNotice('Agreement verified. Historical earnings retain their original rate snapshots. Re-verify store activation before advertising discounts.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save rates.'); }
    finally { setBusy(false); }
  }
  if (admin && !affiliateId) return null;
  return <section className="glass-surface rounded-lg p-5 space-y-4"><h2 className="text-xl font-medium">Category agreements</h2><p className="text-sm">Direct and recurring commissions go to the selling affiliate. Referral commission goes to that affiliate’s referrer, using the selected revenue or commission base. Customer discount benefits the buyer. An unset category is not a zero-rate agreement. If no Peptides override exists, the original profile agreement still applies to legacy peptide processing; it is not replaced by a default here.</p><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr>{['Category', 'Direct %', 'Recurring %', 'Referral %', 'Buyer discount %', 'Referrer base'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{['peptides', 'supplements', 'skincare', 'app'].map(c => { const r = saved.find(rate => rate.category === c); return <tr key={c}><td className="p-2">{c}</td>{fields.map(k => <td className="p-2" key={k}>{r?.[k] ?? 'Not configured'}</td>)}<td className="p-2">{r?.referralBase ?? 'Not configured'}</td></tr>; })}</tbody></table></div>{admin && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void save(); }}><label className="text-xs grid gap-1">Category<select className={control} value={category} onChange={e => setCategory(e.target.value)}>{['peptides', 'supplements', 'skincare', 'app'].map(c => <option key={c}>{c}</option>)}</select></label>{fields.map((k, i) => <label className="text-xs grid gap-1" key={k}>{['Direct %', 'Recurring %', 'Referral %', 'Buyer discount %'][i]}<input className={`${control} w-28`} required type="number" min="0" max="100" step="0.01" value={draft[k] ?? ''} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} /></label>)}<label className="text-xs grid gap-1">Referrer earning base<select className={control} value={base} onChange={e => setBase(e.target.value as typeof base)}><option value="revenue">Attributed revenue</option><option value="commission">Selling affiliate commission</option></select></label><button disabled={busy} className={button}>{busy ? 'Saving…' : 'Save agreement'}</button></form>}{notice && <p role="status">{notice}</p>}</section>;
}
