"use client";

import type { SubscriptionStatus } from "@/lib/customer-account/types";

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {ACTIVE: "Active", PAUSED: "Paused", CANCELLED: "Cancelled", EXPIRED: "Ended", FAILED: "Payment issue", STALE: "Inactive"};
export function StatusPill({status}: {status: SubscriptionStatus}) {
  return <span className={`account-pill status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}
