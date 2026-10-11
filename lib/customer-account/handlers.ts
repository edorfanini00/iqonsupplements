import { AccountUnavailable, customerAccountConfig, hostedAccountUrl, type CustomerAccountConfig } from "./config";
import { safeEqual } from "./crypto";
import { exchangeCode, logoutUrl, ProviderError, providerHeaders, startLogin, verifyIdToken, type Fetcher } from "./oauth";
import * as ops from "./operations";
import { safeReturnPath } from "./return-path";
import { clearSessionCookies, clearTransactionCookie, csrfToken, freshSession, newSession, readSession, readTransaction, sessionCookies, transactionCookie, validCsrf, type CustomerSession } from "./session";
import type { ApiError, SessionState, SubscriptionAction } from "./types";
import { parseAddress, profileSchema, fieldErrors, subscriptionActionSchema } from "./validation";
import { gid, mapAddress, mapOrderDetail, mapOrderSummary, mapOverview, mapProfile, mapSubscriptionDetail, mapSubscriptionSummary, numericId } from "./view";

export type Deps = {env?: Record<string, string | undefined>; fetcher?: Fetcher; now?: () => number};
type Ctx = {config: CustomerAccountConfig; fetcher: Fetcher; now: () => number};

// Customer responses are per-session: never shared, stored or indexed.
const NO_STORE = {"Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "same-origin"};

function json(body: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers(NO_STORE);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), {status, headers});
}
function redirect(location: string, cookies: string[] = [], referrer = "same-origin") {
  const headers = new Headers({...NO_STORE, "Referrer-Policy": referrer, Location: location});
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, {status: 303, headers});
}
const fail = (error: ApiError["error"], message: string, status: number, cookies: string[] = [], fields?: Record<string, string>) =>
  json({error, message, ...(fields ? {fields} : {})} satisfies ApiError, status, cookies);

function context(deps: Deps): Ctx | null | "invalid" {
  try {
    const config = customerAccountConfig(deps.env ?? process.env);
    return config ? {config, fetcher: deps.fetcher ?? fetch, now: deps.now ?? Date.now} : null;
  } catch (error) {
    if (error instanceof AccountUnavailable) {
      // Configuration problems are operator-visible but never echo secret values.
      console.error(`[customer-account] configuration rejected: ${error.message}`);
      return "invalid";
    }
    throw error;
  }
}

// ---------- Browser navigation routes: /account/login, /account/callback, /account/logout ----------

export async function loginRoute(request: Request, deps: Deps = {}) {
  const ctx = context(deps);
  if (!ctx || ctx === "invalid") return redirect("/account");
  if (isPrefetch(request)) return new Response(null, {status: 204, headers: NO_STORE});
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get("return"));
  const {session} = await readSession(ctx.config, request, ctx.now());
  if (session) return redirect(returnTo);
  const {url: authorize, transaction} = await startLogin(ctx.config, returnTo, ctx.now());
  return redirect(authorize, [await transactionCookie(ctx.config, transaction)], "no-referrer");
}

export async function callbackRoute(request: Request, deps: Deps = {}) {
  const ctx = context(deps);
  if (!ctx || ctx === "invalid") return redirect("/account");
  const {config, fetcher, now} = ctx;
  // The transaction is single use: it is cleared on every outcome, so a replayed callback fails.
  const cleared = [clearTransactionCookie(config)];
  const back = (reason: string) => redirect(`/account?signin=${reason}`, cleared, "no-referrer");
  const params = new URL(request.url).searchParams;
  const tx = await readTransaction(config, request, now());
  if (!tx) return back("expired");
  const state = params.get("state") || "";
  if (!state || !safeEqual(state, tx.state)) return back("failed");
  if (params.get("error")) return back(params.get("error") === "access_denied" ? "cancelled" : "failed");
  const code = params.get("code") || "";
  if (!code || code.length > 4096) return back("failed");
  try {
    const tokens = await exchangeCode(config, code, tx.verifier, fetcher, now());
    const claims = await verifyIdToken(config, tokens.idToken, tx.nonce, fetcher, now());
    // A fresh session id on every sign-in: no fixation from any earlier cookie.
    const session = newSession(claims.sub, tokens, now());
    return redirect(safeReturnPath(tx.returnTo), [...cleared, ...await sessionCookies(config, session, now())], "no-referrer");
  } catch (error) {
    if (error instanceof ProviderError) {
      console.warn(`[customer-account] sign-in ${error.kind}: ${error.message}`);
      return back(error.kind === "unavailable" ? "unavailable" : "failed");
    }
    throw error;
  }
}

export async function logoutRoute(request: Request, deps: Deps = {}) {
  const ctx = context(deps);
  if (!ctx || ctx === "invalid") return redirect("/account/signed-out");
  if (request.method !== "POST" || !sameOriginRequest(request, ctx.config)) return fail("forbidden", "Sign out from your account page.", 403);
  const {session} = await readSession(ctx.config, request, ctx.now());
  // Local session ends first. Shopify's end-session endpoint only accepts GET with
  // id_token_hint (POST is rejected), so the hint is sent to Shopify with no referrer.
  return redirect(session ? logoutUrl(ctx.config, session.tokens.idToken) : "/account/signed-out", clearSessionCookies(ctx.config), "no-referrer");
}

function isPrefetch(request: Request) {
  const purpose = `${request.headers.get("sec-purpose") || ""} ${request.headers.get("purpose") || ""}`;
  return /prefetch|prerender/i.test(purpose) || request.headers.has("next-router-prefetch") || request.headers.has("rsc");
}

function sameOriginRequest(request: Request, config: CustomerAccountConfig) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return request.headers.get("origin") === config.origin;
}

// ---------- JSON BFF: /api/account/* ----------

type Upstream = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
type Handler = (input: {ctx: Ctx; session: CustomerSession; query: Upstream; body: unknown; request: Request}) => Promise<Response>;

class Upstream401 extends Error {}

async function customerGraphql<T>(ctx: Ctx, session: CustomerSession, query: string, variables: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await ctx.fetcher(ctx.config.graphqlEndpoint, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: providerHeaders(ctx.config, {"Content-Type": "application/json", "Accept": "application/json", "Authorization": session.tokens.accessToken}),
      body: JSON.stringify({query, variables}),
    });
  } catch { throw new ProviderError("unavailable", "customer api unreachable"); }
  if (response.status === 401) throw new Upstream401("access token rejected");
  if (!response.ok) throw new ProviderError("unavailable", `customer api returned ${response.status}`);
  const result = await response.json().catch(() => null) as {data?: T; errors?: {message?: string; extensions?: {code?: string}}[]} | null;
  if (!result) throw new ProviderError("unavailable", "customer api returned invalid JSON");
  // Only an authentication failure ends the session. ACCESS_DENIED is a field/scope permission
  // error (for example an undocumented field) and must never sign the customer out.
  if (result.errors?.some(e => e.extensions?.code === "UNAUTHENTICATED")) throw new Upstream401("access token rejected");
  if (result.errors?.length || !result.data) {
    // Messages may describe the query, never customer data; codes only.
    console.warn(`[customer-account] customer api errors: ${(result.errors || []).map(e => e.extensions?.code || "UNKNOWN").join(",")}`);
    throw new ProviderError("unavailable", "customer api returned errors");
  }
  return result.data;
}

async function withCustomer(request: Request, deps: Deps, handler: Handler, options: {mutation?: boolean; clearOnReject?: boolean} = {}) {
  const ctx = context(deps);
  if (ctx === null) return fail("not_configured", "Accounts are not available yet.", 503);
  if (ctx === "invalid") return fail("unavailable", "Your account is temporarily unavailable. Please try again shortly.", 503);
  const {config} = ctx;
  let body: unknown = undefined;
  if (options.mutation) {
    if (!sameOriginRequest(request, config)) return fail("forbidden", "This request was blocked.", 403);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) return fail("invalid", "Invalid request.", 415);
    const text = await request.text();
    if (text.length > 8192) return fail("invalid", "Invalid request.", 413);
    try { body = text ? JSON.parse(text) : {}; } catch { return fail("invalid", "Invalid request.", 400); }
  }
  const {session: stored, present} = await readSession(config, request, ctx.now());
  if (!stored) return fail("signed_out", "Please sign in to continue.", 401, present ? clearSessionCookies(config) : []);
  if (options.mutation && !await validCsrf(config, stored, request.headers.get("x-iqb-csrf"))) return fail("forbidden", "Your session changed. Refresh the page and try again.", 403);
  let session = stored, rotated = false;
  const refresh = async (force: boolean) => {
    const next = await freshSession(config, force ? {...session, tokens: {...session.tokens, accessTokenExpiresAt: 0}} : session, ctx.fetcher, ctx.now());
    if (next.rotated) { session = next.session; rotated = true; }
  };
  try {
    await refresh(false);
    let retried = false;
    const query: Upstream = async <T,>(document: string, variables: Record<string, unknown> = {}) => {
      try { return await customerGraphql<T>(ctx, session, document, variables); }
      catch (error) {
        // An access token revoked before its expiry gets exactly one refresh attempt.
        if (!(error instanceof Upstream401) || retried) throw error;
        retried = true;
        await refresh(true);
        return customerGraphql<T>(ctx, session, document, variables);
      }
    };
    const response = await handler({ctx, session, query, body, request});
    if (rotated) for (const cookie of await sessionCookies(config, session, ctx.now())) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    // The grant was rejected. This request may carry a cookie that a concurrent request (possibly
    // on another serverless instance) has already rotated, so it must not clear the browser's
    // newer cookie. The client re-checks /api/account/session, which clears a truly dead session.
    if (error instanceof Upstream401 || (error instanceof ProviderError && error.kind === "rejected")) return fail("signed_out", "Your session has ended. Please sign in again.", 401, options.clearOnReject ? clearSessionCookies(config) : []);
    if (error instanceof ProviderError) {
      console.warn(`[customer-account] upstream unavailable: ${error.message}`);
      return fail("unavailable", "We couldn’t reach your account right now. Please try again.", 503, rotated ? await sessionCookies(config, session, ctx.now()) : []);
    }
    console.error("[customer-account] unexpected failure", error instanceof Error ? error.name : "unknown");
    return fail("unavailable", "Something went wrong. Please try again.", 500);
  }
}

type UserError = {code?: string | null; field?: string[] | null; message: string};
function userErrorResponse(errors: UserError[]) {
  const fields: Record<string, string> = {};
  for (const e of errors) { const key = e.field?.at(-1) || "form"; fields[key] ??= e.message; }
  return fail("invalid", errors[0]?.message || "Please check the details and try again.", 422, [], fields);
}

export async function sessionApi(request: Request, deps: Deps = {}) {
  const ctx = context(deps);
  if (ctx === null) return json({status: "not_configured"} satisfies SessionState);
  if (ctx === "invalid") return json({status: "unavailable"} satisfies SessionState, 503);
  const {session, present} = await readSession(ctx.config, request, ctx.now());
  if (!session) return json({status: "signed_out"} satisfies SessionState, 200, present ? clearSessionCookies(ctx.config) : []);
  const response = await withCustomer(request, deps, async ({ctx, session, query}) => {
    const data = await query<{customer: Record<string, unknown>}>(ops.ACCOUNT_PROFILE);
    const profile = mapProfile(data.customer);
    return json({status: "signed_in", csrf: await csrfToken(ctx.config, session), firstName: profile.firstName, email: profile.email, hostedAccountUrl: hostedAccountUrl(ctx.config), subscriptionManagementUrl: ctx.config.subscriptionManagementUrl} satisfies SessionState);
   }, {clearOnReject: true});
  if (response.status === 401) return json({status: "signed_out"} satisfies SessionState, 200, response.headers.getSetCookie());
  if (response.status >= 500) return json({status: "unavailable"} satisfies SessionState, 503, response.headers.getSetCookie());
  return response;
}

export const overviewApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query}) => {
  const data = await query<{customer: Record<string, unknown>}>(ops.ACCOUNT_OVERVIEW);
  return json(mapOverview(data.customer));
});

export const ordersApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query, request}) => {
  const after = new URL(request.url).searchParams.get("after");
  if (after !== null && !/^[A-Za-z0-9+/=_:-]{1,512}$/.test(after)) return fail("invalid", "Invalid page.", 400);
  const data = await query<{customer: {orders: {pageInfo: {hasNextPage: boolean; endCursor: string | null}; nodes: Record<string, unknown>[]}}}>(ops.ACCOUNT_ORDERS, {after});
  const {pageInfo, nodes} = data.customer.orders;
  return json({orders: nodes.map(mapOrderSummary), nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null});
});

export const orderApi = (request: Request, id: string, deps: Deps = {}) => withCustomer(request, deps, async ({query}) => {
  if (!/^\d{1,20}$/.test(id)) return fail("not_found", "We couldn’t find that order.", 404);
  // The customer access token only resolves this customer's own orders; others return null.
  const data = await query<{order: Record<string, unknown> | null}>(ops.ACCOUNT_ORDER, {id: gid("Order", id)});
  if (!data.order || numericId(data.order.id, "Order") !== id) return fail("not_found", "We couldn’t find that order.", 404);
  return json(mapOrderDetail(data.order));
});

type AddressBook = {customer: {defaultAddress: {id: string} | null; addresses: {nodes: Record<string, unknown>[]}}};
/** The customer's own address book, plus each entry's exact provider id for mutations. */
async function readAddressBook(query: Upstream) {
  const data = await query<AddressBook>(ops.ACCOUNT_ADDRESSES);
  const defaultId = data.customer.defaultAddress?.id ?? null;
  const entries = data.customer.addresses.nodes.map(node => ({address: mapAddress(node, defaultId)!, providerId: String(node.id)})).filter(entry => entry.address);
  entries.sort((a, b) => Number(b.address.isDefault) - Number(a.address.isDefault));
  return entries;
}
async function addressBook(query: Upstream) { return (await readAddressBook(query)).map(entry => entry.address); }

export const addressesApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query}) => json({addresses: await addressBook(query)}));

export const createAddressApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query, body}) => {
  const parsed = parseAddress(body);
  if (!parsed.ok) return fail("invalid", "Please check the highlighted fields.", 422, [], parsed.fields);
  const result = await query<{customerAddressCreate: {customerAddress: {id: string} | null; userErrors: UserError[]}}>(ops.ADDRESS_CREATE, {address: parsed.address, defaultAddress: parsed.makeDefault});
  if (result.customerAddressCreate.userErrors.length) return userErrorResponse(result.customerAddressCreate.userErrors);
  return json({addresses: await addressBook(query)}, 201);
}, {mutation: true});

/** The id must already be in this customer's own address book before any write is attempted;
 *  the write then uses Shopify's own id for that entry, never one built from the URL. */
async function ownAddress(query: Upstream, id: string) {
  if (!/^\d{1,20}$/.test(id)) return null;
  return (await readAddressBook(query)).find(entry => entry.address.id === id)?.providerId || null;
}

export const updateAddressApi = (request: Request, id: string, deps: Deps = {}) => withCustomer(request, deps, async ({query, body}) => {
  const addressId = await ownAddress(query, id);
  if (!addressId) return fail("not_found", "We couldn’t find that address.", 404);
  const onlyDefault = !!body && typeof body === "object" && Object.keys(body).length === 1 && (body as Record<string, unknown>).makeDefault === true;
  let variables: Record<string, unknown>;
  if (onlyDefault) variables = {addressId, defaultAddress: true};
  else {
    const parsed = parseAddress(body);
    if (!parsed.ok) return fail("invalid", "Please check the highlighted fields.", 422, [], parsed.fields);
    variables = {addressId, address: parsed.address, ...(parsed.makeDefault ? {defaultAddress: true} : {})};
  }
  const result = await query<{customerAddressUpdate: {userErrors: UserError[]}}>(ops.ADDRESS_UPDATE, variables);
  if (result.customerAddressUpdate.userErrors.length) return userErrorResponse(result.customerAddressUpdate.userErrors);
  return json({addresses: await addressBook(query)});
}, {mutation: true});

export const deleteAddressApi = (request: Request, id: string, deps: Deps = {}) => withCustomer(request, deps, async ({query}) => {
  const addressId = await ownAddress(query, id);
  if (!addressId) return fail("not_found", "We couldn’t find that address.", 404);
  const result = await query<{customerAddressDelete: {userErrors: UserError[]}}>(ops.ADDRESS_DELETE, {addressId});
  if (result.customerAddressDelete.userErrors.length) return userErrorResponse(result.customerAddressDelete.userErrors);
  return json({addresses: await addressBook(query)});
}, {mutation: true});

export const profileApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query}) => {
  const data = await query<{customer: Record<string, unknown>}>(ops.ACCOUNT_PROFILE);
  return json(mapProfile(data.customer));
});

export const updateProfileApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({query, body}) => {
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", "Please check the highlighted fields.", 422, [], fieldErrors(parsed.error));
  const result = await query<{customerUpdate: {userErrors: UserError[]}}>(ops.PROFILE_UPDATE, {input: parsed.data});
  if (result.customerUpdate.userErrors.length) return userErrorResponse(result.customerUpdate.userErrors);
  const data = await query<{customer: Record<string, unknown>}>(ops.ACCOUNT_PROFILE);
  return json(mapProfile(data.customer));
}, {mutation: true});

/** Undocumented extras: a denial or error degrades to null; an expired session still propagates. */
async function optional<T>(query: Upstream, document: string, variables: Record<string, unknown> = {}): Promise<T | null> {
  try { return await query<T>(document, variables); }
  catch (error) { if (error instanceof ProviderError && error.kind === "unavailable") return null; throw error; }
}

export const subscriptionsApi = (request: Request, deps: Deps = {}) => withCustomer(request, deps, async ({ctx, query}) => {
  const data = await query<{customer: {subscriptionContracts: {nodes: Record<string, unknown>[]}}}>(ops.ACCOUNT_SUBSCRIPTIONS);
  const extras = await optional<{customer: {subscriptionContracts: {nodes: Record<string, unknown>[]}}}>(query, ops.SUBSCRIPTION_EXTRAS_LIST);
  const byId = new Map((extras?.customer.subscriptionContracts.nodes || []).map(node => [node.id, node]));
  return json({subscriptions: data.customer.subscriptionContracts.nodes.map(node => mapSubscriptionSummary(node, ctx.config.subscriptionManagementUrl, byId.get(node.id) ?? null)), managementUrl: ctx.config.subscriptionManagementUrl});
});

async function ownSubscription(ctx: Ctx, query: Upstream, id: string) {
  if (!/^\d{1,20}$/.test(id)) return null;
  // customer.subscriptionContract only resolves contracts owned by the signed-in customer.
  const data = await query<{customer: {subscriptionContract: Record<string, unknown> | null}}>(ops.ACCOUNT_SUBSCRIPTION, {id: gid("SubscriptionContract", id)});
  const raw = data.customer.subscriptionContract;
  if (!raw || numericId(raw.id, "SubscriptionContract") !== id) return null;
  const extras = await optional<{customer: {subscriptionContract: Record<string, unknown> | null}}>(query, ops.SUBSCRIPTION_EXTRAS, {id: gid("SubscriptionContract", id)});
  return mapSubscriptionDetail(raw, ctx.config.subscriptionManagementUrl, extras?.customer.subscriptionContract ?? null);
}

export const subscriptionApi = (request: Request, id: string, deps: Deps = {}) => withCustomer(request, deps, async ({ctx, query}) => {
  const subscription = await ownSubscription(ctx, query, id);
  return subscription ? json(subscription) : fail("not_found", "We couldn’t find that subscription.", 404);
});

const ACTION_DOCUMENT: Record<SubscriptionAction, string> = {pause: ops.SUBSCRIPTION_PAUSE, resume: ops.SUBSCRIPTION_RESUME, cancel: ops.SUBSCRIPTION_CANCEL, skip: ops.SUBSCRIPTION_SKIP, unskip: ops.SUBSCRIPTION_UNSKIP};

export const subscriptionActionApi = (request: Request, id: string, deps: Deps = {}) => withCustomer(request, deps, async ({ctx, query, body}) => {
  const parsed = subscriptionActionSchema.safeParse(body);
  if (!parsed.success) return fail("invalid", "Invalid request.", 400);
  const input = parsed.data;
  const subscription = await ownSubscription(ctx, query, id);
  if (!subscription) return fail("not_found", "We couldn’t find that subscription.", 404);
  // Re-check against the provider's current state, not what the page last displayed.
  if (!subscription.actions.includes(input.action)) return fail("conflict", "This change isn’t available for this subscription right now.", 409);
  let variables: Record<string, unknown> = {id: gid("SubscriptionContract", id)};
  if (input.action === "skip" || input.action === "unskip") {
    const cycle = subscription.upcoming.find(c => c.cycleIndex === input.cycleIndex);
    if (!cycle || cycle.billed || cycle.skipped !== (input.action === "unskip")) return fail("conflict", "That delivery can’t be changed any more.", 409);
    variables = {input: {contractId: gid("SubscriptionContract", id), selector: {index: input.cycleIndex}}};
  }
  const result = await query<Record<string, {userErrors: UserError[]}>>(ACTION_DOCUMENT[input.action], variables);
  const errors = Object.values(result)[0]?.userErrors || [];
  if (errors.length) return fail("conflict", errors[0].message || "Shopify couldn’t make that change.", 409);
  const updated = await ownSubscription(ctx, query, id);
  return updated ? json(updated) : fail("not_found", "We couldn’t find that subscription.", 404);
}, {mutation: true});
