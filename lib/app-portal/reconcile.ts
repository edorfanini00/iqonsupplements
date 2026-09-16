/**
 * Automatic affiliate commissions on SUPPLEMENTS_APP app subscriptions.
 *
 * For every RevenueCat subscription whose customer can be resolved to an email
 * (the app logs purchases in with the Supabase user id), we check whether that
 * customer's store orders are attributed to an affiliate — by email, or by
 * unique full name when the app email is an Apple private-relay address that
 * can never match a store order. If so, the affiliate
 * is owed `lifetime app gross × app commission rate`. We compare that against
 * the commissions already recorded (auto or manual) for the customer and book
 * the difference as a new pending commission row.
 *
 * Because RevenueCat's lifetime gross grows on every charge, each renewal
 * automatically produces a new commission the next time this runs — no manual
 * clicking. Runs from the daily cron and whenever an admin opens the App tab;
 * fully idempotent (owed becomes $0 after booking).
 *
 * Safety rules:
 *   - Only paying subscribers earn commission (gross > 0) — downloading the
 *     app earns nothing.
 *   - A charge is only credited once the subscription has stayed live for
 *     `SETTLEMENT_HOLD_DAYS` after the billing date, so instant refunds and
 *     failed payments never produce a payout.
 */

import { prisma } from "@/lib/db/prisma";
import {
  fetchAppSubscriptions,
  fetchAppUsers,
  getAppIntegrationStatus,
} from "@/lib/app-portal/analytics";
import { getAppCommissionRate } from "@/lib/app-portal/store";

export interface AppReconcileResult {
  checked: number;
  created: number;
  commission: number;
}

/**
 * Days a charge must "settle" before commission is booked: the subscription
 * has to still be live this long after its billing date, which filters out
 * immediate refunds and payment reversals.
 */
export const SETTLEMENT_HOLD_DAYS = 3;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function emailSlug(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function reconcileAppCommissions(): Promise<AppReconcileResult | null> {
  const status = getAppIntegrationStatus();
  if (!status.revenuecatConfigured) return null;

  const [subsResult, usersResult, rate] = await Promise.all([
    fetchAppSubscriptions(),
    fetchAppUsers().catch(() => ({ users: [], truncated: false })),
    getAppCommissionRate(),
  ]);
  if (!subsResult || rate <= 0) return null;

  const usersById = new Map(usersResult.users.map((u) => [u.id, u]));

  // Lifetime app gross per customer email (a customer can have several
  // subscription rows, e.g. after switching products). Keep the app-account
  // name too — with Apple's private-relay emails the name is the only thing
  // that can link the subscriber to their store purchases.
  const grossByEmail = new Map<string, { gross: number; name: string }>();
  const holdCutoff = Date.now() - SETTLEMENT_HOLD_DAYS * 24 * 60 * 60 * 1000;
  for (const s of subsResult.subscriptions) {
    // Paid subscribers only — an app download or free trial earns nothing.
    if (typeof s.grossUsd !== "number" || s.grossUsd <= 0) continue;
    // The subscription must still be live: refunded/expired/grace-period subs
    // don't generate new commission.
    if (s.status !== "active") continue;
    // Hold each charge for a few days after the billing date. The latest
    // charge is the start of the current period; skipping the subscription
    // now simply defers that charge's commission to a later run — earlier
    // charges were already booked then.
    const lastChargeAt = s.currentPeriodStartsAt ?? s.startedAt;
    if (lastChargeAt && new Date(lastChargeAt).getTime() > holdCutoff) continue;
    const owner = usersById.get(s.customerId);
    const email = s.email ?? owner?.email ?? null;
    if (!email || !email.includes("@")) continue;
    const key = email.toLowerCase().trim();
    const entry = grossByEmail.get(key);
    if (entry) {
      entry.gross += s.grossUsd;
      if (!entry.name && owner?.name) entry.name = owner.name;
    } else {
      grossByEmail.set(key, { gross: s.grossUsd, name: owner?.name ?? "" });
    }
  }
  if (grossByEmail.size === 0) return { checked: 0, created: 0, commission: 0 };

  // Latest direct store attribution per email — same rule the App tab uses.
  // Fetched without an email filter because we also need a full-name index
  // for subscribers whose app email doesn't match any store order.
  const attributionRows = await prisma.affiliateOrder.findMany({
    where: { matchType: { notIn: ["referral", "bonus"] } },
    orderBy: { createdAt: "desc" },
    select: {
      customerEmail: true,
      customerName: true,
      affiliateId: true,
      affiliate: { select: { status: true, portalRole: true } },
    },
  });
  const affiliateByEmail = new Map<string, string>();
  const emailsByName = new Map<string, Set<string>>();
  for (const row of attributionRows) {
    const key = row.customerEmail.toLowerCase().trim();
    const norm = normalizeName(row.customerName ?? "");
    const eligible =
      row.affiliate.status === "active" && row.affiliate.portalRole === "affiliate";
    if (eligible && norm.includes(" ")) {
      const set = emailsByName.get(norm) ?? new Set<string>();
      set.add(key);
      emailsByName.set(norm, set);
    }
    if (affiliateByEmail.has(key)) continue; // rows are newest-first
    if (!eligible) continue;
    affiliateByEmail.set(key, row.affiliateId);
  }

  // Resolve each paying app customer to an affiliate: email match first, then
  // unique full-name match (also gives us the store email so already-booked
  // commissions under either identity are counted once).
  const resolved = new Map<
    string,
    { affiliateId: string; storeEmail: string | null }
  >();
  for (const [email, { name }] of grossByEmail) {
    const direct = affiliateByEmail.get(email);
    if (direct) {
      resolved.set(email, { affiliateId: direct, storeEmail: email });
      continue;
    }
    const norm = normalizeName(name);
    const candidates = norm.includes(" ") ? emailsByName.get(norm) : undefined;
    if (candidates && candidates.size === 1) {
      const storeEmail = [...candidates][0];
      const affiliateId = affiliateByEmail.get(storeEmail);
      if (affiliateId) resolved.set(email, { affiliateId, storeEmail });
    }
  }
  if (resolved.size === 0) {
    return { checked: grossByEmail.size, created: 0, commission: 0 };
  }

  // Commissions already booked per customer (auto + manual, any affiliate),
  // under the app email or the matched store email.
  const candidateEmails = new Set<string>();
  for (const [email, r] of resolved) {
    candidateEmails.add(email);
    if (r.storeEmail) candidateEmails.add(r.storeEmail);
  }
  const existingRows = await prisma.affiliateOrder.findMany({
    where: {
      orderId: { startsWith: "APP-" },
      customerEmail: { in: [...candidateEmails] },
      status: { not: "void" },
    },
    select: { customerEmail: true, commission: true },
  });
  const recordedByEmail = new Map<string, number>();
  for (const row of existingRows) {
    const key = row.customerEmail.toLowerCase().trim();
    recordedByEmail.set(key, (recordedByEmail.get(key) ?? 0) + row.commission);
  }

  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const result: AppReconcileResult = {
    checked: grossByEmail.size,
    created: 0,
    commission: 0,
  };

  for (const [email, { affiliateId, storeEmail }] of resolved) {
    const entry = grossByEmail.get(email);
    if (!entry) continue;
    const target = Math.round(entry.gross * rate) / 100;
    let recorded = recordedByEmail.get(email) ?? 0;
    if (storeEmail && storeEmail !== email) {
      recorded += recordedByEmail.get(storeEmail) ?? 0;
    }
    const owed = Math.round((target - recorded) * 100) / 100;
    if (owed < 0.01) continue;

    // Unique order id per booking: APP-2026-09-jane-x-com, -2, -3, ...
    const base = `APP-${ym}-${emailSlug(email)}`;
    let orderId = base;
    for (let n = 2; n < 50; n++) {
      const exists = await prisma.affiliateOrder.findFirst({
        where: { orderId },
        select: { id: true },
      });
      if (!exists) break;
      orderId = `${base}-${n}`;
    }

    const displayName = entry.name || email;

    await prisma.affiliateOrder.create({
      data: {
        affiliateId,
        orderId,
        customerName: `SUPPLEMENTS_APP app · ${displayName}`,
        customerEmail: email,
        // orderTotal stays 0 — app revenue is tracked from RevenueCat, never
        // from these rows; commission carries the actual payout money.
        orderTotal: 0,
        commission: owed,
        matchType: "bonus",
        status: "pending",
      },
    });
    result.created += 1;
    result.commission += owed;
  }

  result.commission = Math.round(result.commission * 100) / 100;
  return result;
}
