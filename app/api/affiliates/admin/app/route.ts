/**
 * GET  /api/affiliates/admin/app — SUPPLEMENTS_APP mobile app analytics for the admin
 *      dashboard: signups (download proxy), RevenueCat money metrics, the
 *      paying / stopped-paying subscriber lists, and app-user ↔ store-customer
 *      matches (by email, then by name) with their affiliate attribution.
 *
 * POST /api/affiliates/admin/app — { action: "set_rate", rate } to change the
 *      app commission percent, or { action: "record_commission", affiliateId,
 *      customerEmail, customerName, amount } to credit an affiliate for a
 *      matched app subscriber (commission = amount × rate).
 */

import {
  fetchAppMetricsOverview,
  fetchAppSubscriptions,
  fetchAppUsers,
  getAppIntegrationStatus,
  type AppSubscription,
} from "@/lib/app-portal/analytics";
import {
  getAppCommissionRate,
  listAppCommissions,
  recordAppCommission,
  setAppCommissionRate,
} from "@/lib/app-portal/store";
import { reconcileAppCommissions } from "@/lib/app-portal/reconcile";
import { getAllAffiliates, getAllOrders } from "@/lib/affiliates/store";
import { listPaidOrders } from "@/lib/portal-commerce";
import {
  isNextResponse,
  requireAdminSession,
} from "@/lib/affiliates/auth-guards";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { writeAuditLog } from "@/lib/affiliates/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const status = getAppIntegrationStatus();

    const [usersResult, metricsResult, subsResult, shopifyResult, localOrdersResult] =
      await Promise.allSettled([
        fetchAppUsers(),
        fetchAppMetricsOverview(),
        fetchAppSubscriptions(),
        listPaidOrders({ fields: "id,billing,date_created,total" }),
        getAllOrders(),
      ]);

    // Book any commissions owed for app charges before listing them, so the
    // tab always reflects the latest renewals without waiting for the cron.
    let reconciled: Awaited<ReturnType<typeof reconcileAppCommissions>> = null;
    try {
      reconciled = await reconcileAppCommissions();
    } catch (err) {
      console.error("[api/affiliates/admin/app] reconcile", err);
    }

    const [commissionRate, commissions, affiliates] = await Promise.all([
      getAppCommissionRate(),
      listAppCommissions(),
      getAllAffiliates(),
    ]);

    const appUsers =
      usersResult.status === "fulfilled" ? usersResult.value : { users: [], truncated: false };
    const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;
    const subscriptions = subsResult.status === "fulfilled" ? subsResult.value : null;
    const shopifyOrders = shopifyResult.status === "fulfilled" ? shopifyResult.value.orders : [];
    const localOrders =
      localOrdersResult.status === "fulfilled" ? localOrdersResult.value : [];
    const errors: string[] = [];
    if (usersResult.status === "rejected") errors.push("Supabase app users unavailable.");
    if (metricsResult.status === "rejected") errors.push("RevenueCat metrics unavailable.");
    if (subsResult.status === "rejected") errors.push("RevenueCat subscriptions unavailable.");
    if (shopifyResult.status === "rejected") errors.push("Shopify order history unavailable.");

    // The app calls Purchases.logIn(supabaseUserId), so RevenueCat customer
    // ids are Supabase user ids for signed-in users. Resolve subscriber emails
    // through the app-user list (guest purchases stay anonymous).
    const usersById = new Map(appUsers.users.map((u) => [u.id, u]));
    if (subscriptions) {
      for (const s of subscriptions.subscriptions) {
        if (!s.email) {
          const owner = usersById.get(s.customerId);
          if (owner?.email) s.email = owner.email;
        }
      }
    }

    // Best subscription per app user (active beats expired) so matches can show
    // who is currently paying in the app.
    const activeStatuses = new Set(["active", "trialing", "in_grace_period"]);
    const subByKey = new Map<string, AppSubscription>();
    for (const s of subscriptions?.subscriptions ?? []) {
      for (const key of [s.customerId, s.email]) {
        if (!key) continue;
        const prev = subByKey.get(key);
        if (!prev || (activeStatuses.has(s.status) && !activeStatuses.has(prev.status))) {
          subByKey.set(key, s);
        }
      }
    }

    // Store customers by email, plus a name index for fallback matching.
    const storeByEmail = new Map<
      string,
      { name: string; orders: number; totalSpent: number; firstOrderAt: string; lastOrderAt: string }
    >();
    const emailsByName = new Map<string, Set<string>>();
    for (const o of shopifyOrders) {
      const email = o.billing?.email?.toLowerCase().trim();
      if (!email) continue;
      const name = `${o.billing?.first_name ?? ""} ${o.billing?.last_name ?? ""}`.trim();
      const date = o.date_created ?? "";
      const total = Number.parseFloat(o.total ?? "0") || 0;
      const entry = storeByEmail.get(email);
      if (entry) {
        entry.orders += 1;
        entry.totalSpent += total;
        if (date && date < entry.firstOrderAt) entry.firstOrderAt = date;
        if (date && date > entry.lastOrderAt) entry.lastOrderAt = date;
        if (!entry.name && name) entry.name = name;
      } else {
        storeByEmail.set(email, {
          name,
          orders: 1,
          totalSpent: total,
          firstOrderAt: date,
          lastOrderAt: date,
        });
      }
      const norm = normalizeName(name);
      if (norm.includes(" ")) {
        const set = emailsByName.get(norm) ?? new Set<string>();
        set.add(email);
        emailsByName.set(norm, set);
      }
    }

    // Latest direct affiliate attribution per store customer email.
    const affById = new Map(affiliates.map((a) => [a.id, a]));
    const attributionByEmail = new Map<string, { affiliateId: string; at: string }>();
    for (const o of localOrders) {
      if (o.matchType === "referral" || o.matchType === "bonus") continue;
      const email = o.customerEmail?.toLowerCase().trim();
      if (!email) continue;
      const prev = attributionByEmail.get(email);
      if (!prev || o.createdAt > prev.at) {
        attributionByEmail.set(email, { affiliateId: o.affiliateId, at: o.createdAt });
      }
    }

    // Subscribers with resolved identity: the RevenueCat customer id is the
    // Supabase user id, so we can put a real name on each subscription and —
    // via email or unique full name (Apple private-relay emails never match
    // the store) — surface the affiliate the customer is attributed to.
    const subscribersPayload = subscriptions
      ? {
          ...subscriptions,
          subscriptions: subscriptions.subscriptions.map((s) => {
            const owner =
              usersById.get(s.customerId) ??
              (s.email ? appUsers.users.find((u) => u.email === s.email) : undefined);
            let name = owner?.name?.trim() || "";
            let storeEmail: string | null = null;
            if (s.email && storeByEmail.has(s.email)) {
              storeEmail = s.email;
            } else if (name) {
              const norm = normalizeName(name);
              const candidates = norm.includes(" ")
                ? emailsByName.get(norm)
                : undefined;
              if (candidates && candidates.size === 1) {
                storeEmail = [...candidates][0];
              }
            }
            if (!name && storeEmail) {
              name = storeByEmail.get(storeEmail)?.name ?? "";
            }
            const attribution = storeEmail
              ? attributionByEmail.get(storeEmail)
              : undefined;
            const aff = attribution ? affById.get(attribution.affiliateId) : null;
            return {
              ...s,
              name: name || null,
              affiliate: aff
                ? {
                    name: `${aff.firstName} ${aff.lastName}`.trim(),
                    promoCode: aff.promoCode,
                  }
                : null,
            };
          }),
        }
      : null;

    // Commissions already recorded, grouped by app customer email.
    const commissionsByEmail = new Map<string, number>();
    for (const c of commissions) {
      commissionsByEmail.set(
        c.customerEmail,
        (commissionsByEmail.get(c.customerEmail) ?? 0) + 1
      );
    }

    // Match app users to store customers: email first, unique full name second.
    const matches = [];
    for (const u of appUsers.users) {
      let storeEmail: string | null = null;
      let basis: "email" | "name" | null = null;
      if (u.email && storeByEmail.has(u.email)) {
        storeEmail = u.email;
        basis = "email";
      } else if (u.name) {
        const norm = normalizeName(u.name);
        const candidates = norm.includes(" ") ? emailsByName.get(norm) : undefined;
        if (candidates && candidates.size === 1) {
          storeEmail = [...candidates][0];
          basis = "name";
        }
      }
      if (!storeEmail || !basis) continue;
      const store = storeByEmail.get(storeEmail)!;
      const attribution = attributionByEmail.get(storeEmail);
      const affiliate = attribution ? affById.get(attribution.affiliateId) : null;
      const appSub = subByKey.get(u.id) ?? (u.email ? subByKey.get(u.email) : undefined);
      matches.push({
        appSubscription: appSub
          ? {
              status: appSub.status,
              active: activeStatuses.has(appSub.status),
              productName: appSub.productName,
            }
          : null,
        appUser: {
          email: u.email,
          name: u.name,
          provider: u.provider,
          createdAt: u.createdAt,
        },
        store: {
          email: storeEmail,
          name: store.name,
          orders: store.orders,
          totalSpent: Math.round(store.totalSpent * 100) / 100,
          lastOrderAt: store.lastOrderAt,
        },
        basis,
        affiliate: affiliate
          ? {
              id: affiliate.id,
              name: `${affiliate.firstName} ${affiliate.lastName}`.trim(),
              promoCode: affiliate.promoCode,
            }
          : null,
        commissionsRecorded:
          commissionsByEmail.get((u.email || storeEmail).toLowerCase()) ?? 0,
      });
    }
    matches.sort((a, b) => {
      if (Boolean(a.affiliate) !== Boolean(b.affiliate)) return a.affiliate ? -1 : 1;
      const aPaying = a.appSubscription?.active ? 1 : 0;
      const bPaying = b.appSubscription?.active ? 1 : 0;
      if (aPaying !== bPaying) return bPaying - aPaying;
      return b.store.totalSpent - a.store.totalSpent;
    });

    // Signups over the last 30 days for a quick pulse.
    const cutoff30 = Date.now() - 30 * 24 * 3600 * 1000;
    const signups30d = appUsers.users.filter(
      (u) => new Date(u.createdAt).getTime() >= cutoff30
    ).length;

    return apiSuccess({
      status,
      errors,
      commissionRate,
      users: {
        total: appUsers.users.length,
        last30d: signups30d,
        truncated: appUsers.truncated,
        recent: appUsers.users
          .filter((u) => u.email || u.name)
          .sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
          .slice(0, 100)
          .map((u) => ({
            email: u.email,
            name: u.name,
            provider: u.provider,
            createdAt: u.createdAt,
          })),
      },
      metrics,
      subscriptions: subscribersPayload,
      matches: matches.slice(0, 200),
      commissions,
      reconciled,
    });
  } catch (err) {
    console.error("[api/affiliates/admin/app]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 30, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      rate?: number;
      affiliateId?: string;
      customerEmail?: string;
      customerName?: string;
      amount?: number;
    };

    if (body.action === "set_rate") {
      const value = Number(body.rate);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return apiError("VALIDATION_ERROR", "Rate must be between 0 and 100.", 400);
      }
      const before = await getAppCommissionRate();
      await setAppCommissionRate(value);
      await writeAuditLog({
        actorPortalUserId: session.portalUserId,
        actorEmail: session.email,
        action: "app.commission_rate.update",
        before: { rate: before },
        after: { rate: value },
        request,
      });
      return apiSuccess({ commissionRate: value });
    }

    if (body.action === "record_commission") {
      const affiliateId = (body.affiliateId ?? "").trim();
      const customerEmail = (body.customerEmail ?? "").toLowerCase().trim();
      const customerName = (body.customerName ?? "").trim();
      const amount = Number(body.amount);
      if (!affiliateId) return apiError("VALIDATION_ERROR", "Pick an affiliate.", 400);
      if (!customerEmail || !customerEmail.includes("@")) {
        return apiError("VALIDATION_ERROR", "Customer email is required.", 400);
      }
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) {
        return apiError("VALIDATION_ERROR", "Enter a valid subscription amount.", 400);
      }

      const commissionRate = await getAppCommissionRate();
      const result = await recordAppCommission({
        affiliateId,
        customerEmail,
        customerName,
        amount,
        rate: commissionRate,
      });
      if (!result.ok) {
        return apiError("RECORD_FAILED", result.reason ?? "Could not record commission.", 400);
      }

      await writeAuditLog({
        actorPortalUserId: session.portalUserId,
        actorEmail: session.email,
        action: "app.commission.record",
        targetAffiliateId: affiliateId,
        after: {
          customerEmail,
          amount,
          rate: commissionRate,
          commission: result.commission,
          orderId: result.orderId,
        },
        request,
      });
      return apiSuccess({
        commission: result.commission,
        orderId: result.orderId,
      });
    }

    return apiError("VALIDATION_ERROR", "Unknown action.", 400);
  } catch (err) {
    console.error("[api/affiliates/admin/app]", err);
    return apiError("INTERNAL_ERROR", "Something went wrong", 500);
  }
}
