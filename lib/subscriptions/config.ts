/** Display-only mirror of Health's existing subscription intervals.
 * No billing, provider credentials, scheduling or mutation implementation.
 */
export const SUBSCRIPTION_INTERVAL_OPTIONS = [
  { days: 10, label: 'Every 10 days' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Every month' },
  { days: 60, label: 'Every 2 months' },
];
export function subscriptionIntervalLabel(days: number): string {
  return SUBSCRIPTION_INTERVAL_OPTIONS.find(option => option.days === days)?.label ?? `Every ${days} days`;
}
