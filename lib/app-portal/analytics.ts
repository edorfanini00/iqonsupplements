/**
 * SUPPLEMENTS_APP mobile app analytics — server-side clients for the two systems the
 * app runs on:
 *
 *  - A separate supplements Supabase project: app accounts. Signups are the
 *    closest proxy we have for downloads, and give us email + name for
 *    matching app users to store customers.
 *  - RevenueCat: app subscription money. Metrics overview (MRR, active subs,
 *    28-day revenue), the revenue chart (range-based revenue for the admin
 *    overview), and per-customer subscription state (who pays / who stopped).
 *
 * Everything degrades gracefully: when env vars are missing the callers get
 * a "not configured" status instead of errors. Responses are cached in-module
 * because RevenueCat rate limits are tight (25-48 requests/minute).
 */

const SUPABASE_URL = (
  process.env.SUPPLEMENTS_APP_SUPABASE_URL ?? ""
).replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPPLEMENTS_APP_SUPABASE_SERVICE_ROLE_KEY ?? "";
const RC_API_KEY = process.env.SUPPLEMENTS_REVENUECAT_SECRET_API_KEY ?? "";
const RC_PROJECT_ID = process.env.SUPPLEMENTS_REVENUECAT_PROJECT_ID ?? "";
const RC_BASE = "https://api.revenuecat.com/v2";

export interface AppIntegrationStatus {
  supabaseConfigured: boolean;
  revenuecatConfigured: boolean;
  /** Env var names that still need to be set. */
  missing: string[];
}

export function getAppIntegrationStatus(): AppIntegrationStatus {
  const missing: string[] = [];
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) missing.push("SUPPLEMENTS_APP_SUPABASE_SERVICE_ROLE_KEY");
  if (!RC_API_KEY) missing.push("REVENUECAT_SECRET_API_KEY");
  if (!RC_PROJECT_ID) missing.push("REVENUECAT_PROJECT_ID");
  return {
    supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY),
    revenuecatConfigured: Boolean(RC_API_KEY && RC_PROJECT_ID),
    missing,
  };
}

// ---------------------------------------------------------------------------
// Tiny TTL cache (module scope — survives across requests on a warm lambda)
// ---------------------------------------------------------------------------

const cache = new Map<string, { at: number; value: unknown }>();

function cached<T>(key: string, ttlMs: number): T | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  return null;
}

function setCache(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
}

// ---------------------------------------------------------------------------
// Supabase — app users
// ---------------------------------------------------------------------------

export interface AppUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  createdAt: string;
}

interface SupabaseAdminUser {
  id: string;
  email?: string | null;
  created_at?: string;
  user_metadata?: { full_name?: string; name?: string } | null;
  app_metadata?: { provider?: string } | null;
  is_anonymous?: boolean;
}

/**
 * All app accounts from Supabase Auth (service role required). Paginates the
 * admin users endpoint; capped at 5,000 accounts per refresh.
 */
export async function fetchAppUsers(): Promise<{
  users: AppUser[];
  truncated: boolean;
}> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return { users: [], truncated: false };
  const hit = cached<{ users: AppUser[]; truncated: boolean }>("sb-users", 5 * 60_000);
  if (hit) return hit;

  const perPage = 200;
  const maxPages = 25;
  const users: AppUser[] = [];
  let truncated = false;

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        cache: "no-store",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    if (!res.ok) {
      throw new Error(`Supabase admin users returned ${res.status}`);
    }
    const data = (await res.json()) as { users?: SupabaseAdminUser[] };
    const batch = Array.isArray(data.users) ? data.users : [];
    for (const u of batch) {
      users.push({
        id: u.id,
        email: (u.email ?? "").toLowerCase().trim(),
        name: (u.user_metadata?.full_name ?? u.user_metadata?.name ?? "").trim(),
        provider: u.is_anonymous ? "guest" : (u.app_metadata?.provider ?? "email"),
        createdAt: u.created_at ?? "",
      });
    }
    if (batch.length < perPage) break;
    if (page === maxPages) truncated = true;
  }

  const result = { users, truncated };
  setCache("sb-users", result);
  return result;
}

// ---------------------------------------------------------------------------
// RevenueCat — metrics, revenue chart, subscriptions
// ---------------------------------------------------------------------------

async function rcFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${RC_BASE}${path}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${RC_API_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RevenueCat ${path} returned ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface AppOverviewMetrics {
  activeSubscriptions: number | null;
  activeTrials: number | null;
  mrr: number | null;
  /** Revenue in the trailing 28 days (RevenueCat's fixed overview window). */
  revenue28d: number | null;
  newCustomers: number | null;
  activeUsers: number | null;
}

export async function fetchAppMetricsOverview(): Promise<AppOverviewMetrics | null> {
  if (!RC_API_KEY || !RC_PROJECT_ID) return null;
  const hit = cached<AppOverviewMetrics>("rc-overview", 5 * 60_000);
  if (hit) return hit;

  const data = await rcFetch<{
    metrics?: { id: string; value: number | null }[];
  }>(`/projects/${RC_PROJECT_ID}/metrics/overview`);

  const byId = new Map(
    (data.metrics ?? []).map((m) => [m.id, typeof m.value === "number" ? m.value : null])
  );
  const result: AppOverviewMetrics = {
    activeSubscriptions: byId.get("active_subscriptions") ?? null,
    activeTrials: byId.get("active_trials") ?? null,
    mrr: byId.get("mrr") ?? null,
    revenue28d: byId.get("revenue") ?? null,
    newCustomers: byId.get("new_customers") ?? null,
    activeUsers: byId.get("active_users") ?? null,
  };
  setCache("rc-overview", result);
  return result;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface AppRevenuePoint {
  /** ISO date of the period start (daily resolution). */
  date: string;
  value: number;
}

export interface AppRevenueChart {
  total: number;
  points: AppRevenuePoint[];
}

/**
 * App revenue (USD) inside a date window, from the RevenueCat revenue chart —
 * both the range total and the daily series (for the overview trend chart).
 * The response format has shifted between doc versions, so parsing is
 * deliberately tolerant: points may be [timestamp, value, ...] tuples or
 * { cohort, measure, value } objects; the summary total is preferred when
 * present.
 */
export async function fetchAppRevenueChart(
  start: Date,
  end: Date
): Promise<AppRevenueChart | null> {
  if (!RC_API_KEY || !RC_PROJECT_ID) return null;
  const key = `rc-revenue-${toDateString(start)}-${toDateString(end)}`;
  const hit = cached<AppRevenueChart>(key, 5 * 60_000);
  if (hit != null) return hit;

  const data = await rcFetch<Record<string, unknown>>(
    `/projects/${RC_PROJECT_ID}/charts/revenue?start_date=${toDateString(start)}&end_date=${toDateString(end)}&resolution=day`
  );
  const root = (data.data ?? data) as Record<string, unknown>;

  const points: AppRevenuePoint[] = [];
  if (Array.isArray(root.values)) {
    for (const point of root.values as unknown[]) {
      if (Array.isArray(point)) {
        // [timestamp, primaryValue, ...secondaryValues]
        const ts = Number(point[0]);
        const v = Number(point[1]);
        if (Number.isFinite(ts) && Number.isFinite(v)) {
          points.push({ date: tsToIso(ts) ?? "", value: v });
        }
      } else if (point && typeof point === "object") {
        const p = point as { cohort?: number; measure?: number; value?: number };
        if ((p.measure ?? 0) === 0 && typeof p.value === "number") {
          points.push({ date: tsToIso(p.cohort) ?? "", value: p.value });
        }
      }
    }
  }

  let total: number | null = null;
  const summary = root.summary as
    | { total?: number | Record<string, number> }
    | undefined;
  if (summary && summary.total != null) {
    if (typeof summary.total === "number") {
      total = summary.total;
    } else if (typeof summary.total === "object") {
      const revenueKey = Object.keys(summary.total).find((k) =>
        k.toLowerCase().includes("revenue")
      );
      if (revenueKey) total = summary.total[revenueKey];
    }
  }
  if (total == null) {
    total = points.reduce((sum, p) => sum + p.value, 0);
  }

  const result: AppRevenueChart = {
    total: Math.round(total * 100) / 100,
    points: points.filter((p) => p.date),
  };
  setCache(key, result);
  return result;
}

/** Range total only — thin wrapper over fetchAppRevenueChart. */
export async function fetchAppRevenueForRange(
  start: Date,
  end: Date
): Promise<number | null> {
  const chart = await fetchAppRevenueChart(start, end);
  return chart ? chart.total : null;
}

export interface AppSubscription {
  customerId: string;
  email: string | null;
  productName: string;
  status: string;
  store: string;
  startedAt: string | null;
  /** When the current billing period began — i.e. the latest charge. */
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  autoRenews: boolean | null;
  grossUsd: number | null;
  country: string | null;
}

interface RcListResponse<T> {
  items?: T[];
  next_page?: string | null;
}

interface RcCustomer {
  id: string;
  first_seen_at?: number;
  last_seen_at?: number | null;
  attributes?: { items?: { name: string; value: string | null }[] } | null;
}

interface RcSubscription {
  id: string;
  product_id?: string;
  status?: string;
  store?: string;
  starts_at?: number | null;
  current_period_starts_at?: number | null;
  current_period_ends_at?: number | null;
  auto_renewal_status?: string | null;
  country?: string | null;
  total_revenue_in_usd?: { gross?: number } | null;
}

interface RcProduct {
  id: string;
  store_identifier?: string;
  display_name?: string | null;
}

function tsToIso(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  // RevenueCat v2 uses ms epochs; tolerate seconds just in case.
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
}

async function fetchRcProducts(): Promise<Map<string, string>> {
  const hit = cached<Map<string, string>>("rc-products", 30 * 60_000);
  if (hit) return hit;
  const map = new Map<string, string>();
  try {
    const data = await rcFetch<RcListResponse<RcProduct>>(
      `/projects/${RC_PROJECT_ID}/products?limit=100`
    );
    for (const p of data.items ?? []) {
      map.set(p.id, p.display_name || p.store_identifier || p.id);
    }
  } catch {
    // Product names are cosmetic; ids are shown when this fails.
  }
  setCache("rc-products", map);
  return map;
}

/**
 * Every subscription RevenueCat knows about, walked customer by customer
 * (there is no project-wide subscription list in the v2 API). Detail calls are
 * budgeted to respect RevenueCat's rate limit; when the customer base outgrows
 * the budget, the most recently seen customers win and `partial` is set.
 */
export async function fetchAppSubscriptions(): Promise<{
  subscriptions: AppSubscription[];
  totalCustomers: number;
  partial: boolean;
} | null> {
  if (!RC_API_KEY || !RC_PROJECT_ID) return null;
  const hit = cached<{
    subscriptions: AppSubscription[];
    totalCustomers: number;
    partial: boolean;
  }>("rc-subscriptions", 15 * 60_000);
  if (hit) return hit;

  // 1. Customer list (100 per call, cap 10 pages).
  const customers: RcCustomer[] = [];
  let path: string | null = `/projects/${RC_PROJECT_ID}/customers?limit=100&expand=attributes`;
  for (let page = 0; page < 10 && path; page++) {
    const data: RcListResponse<RcCustomer> & { next_page?: string | null } =
      await rcFetch(path);
    customers.push(...(data.items ?? []));
    path = data.next_page
      ? data.next_page.replace(/^https?:\/\/[^/]+\/v2/, "")
      : null;
  }

  // 2. Per-customer subscriptions, newest-seen first, budgeted.
  const DETAIL_BUDGET = 160;
  const ordered = [...customers].sort(
    (a, b) => (b.last_seen_at ?? b.first_seen_at ?? 0) - (a.last_seen_at ?? a.first_seen_at ?? 0)
  );
  const toInspect = ordered.slice(0, DETAIL_BUDGET);
  const partial = ordered.length > DETAIL_BUDGET;
  const products = await fetchRcProducts();

  const subscriptions: AppSubscription[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < toInspect.length; i += CONCURRENCY) {
    const chunk = toInspect.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((c) =>
        rcFetch<RcListResponse<RcSubscription>>(
          `/projects/${RC_PROJECT_ID}/customers/${encodeURIComponent(c.id)}/subscriptions?limit=20`
        ).then((data) => ({ customer: c, subs: data.items ?? [] }))
      )
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { customer, subs } = r.value;
      const email =
        customer.attributes?.items?.find((a) => a.name === "$email")?.value ??
        (customer.id.includes("@") ? customer.id : null);
      for (const s of subs) {
        subscriptions.push({
          customerId: customer.id,
          email: email ? email.toLowerCase().trim() : null,
          productName: products.get(s.product_id ?? "") ?? s.product_id ?? "Unknown",
          status: s.status ?? "unknown",
          store: s.store ?? "app_store",
          startedAt: tsToIso(s.starts_at),
          currentPeriodStartsAt: tsToIso(s.current_period_starts_at),
          currentPeriodEndsAt: tsToIso(s.current_period_ends_at),
          autoRenews:
            s.auto_renewal_status == null
              ? null
              : s.auto_renewal_status === "will_renew",
          grossUsd:
            typeof s.total_revenue_in_usd?.gross === "number"
              ? s.total_revenue_in_usd.gross
              : null,
          country: s.country ?? null,
        });
      }
    }
  }

  subscriptions.sort(
    (a, b) =>
      new Date(b.startedAt ?? 0).getTime() - new Date(a.startedAt ?? 0).getTime()
  );

  const result = { subscriptions, totalCustomers: customers.length, partial };
  setCache("rc-subscriptions", result);
  return result;
}
