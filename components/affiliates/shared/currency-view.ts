/** Presentation of authoritative currency buckets, never legacy scalar fallbacks. */
export type MoneyBucket = {currency: string | null; [field: string]: number | string | null};
export interface BucketedMoney { currencies: MoneyBucket[] }
export function formatDenominated(amount: number, currency?: string | null): string {
  return `${currency || 'Unknown currency'} ${amount.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
export function formatBuckets(value: BucketedMoney | null | undefined, field: string): string {
  if (!value) return 'Unavailable';
  if (!value.currencies.length) return 'No monetary activity';
  return value.currencies.map(b => typeof b[field] === 'number' ? formatDenominated(b[field] as number, b.currency) : 'Unavailable').join(' · ');
}
export function combineBuckets(values: BucketedMoney[], fields: string[]): BucketedMoney {
  const buckets = new Map<string | null, MoneyBucket>();
  for (const value of values) for (const row of value.currencies) {
    const bucket = buckets.get(row.currency) ?? {currency:row.currency};
    for (const field of fields) bucket[field] = Number(bucket[field] ?? 0) + Number(row[field] ?? 0);
    buckets.set(row.currency, bucket);
  }
  return {currencies:[...buckets.values()]};
}
