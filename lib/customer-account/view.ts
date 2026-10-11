import type { AccountAddress, AccountOverview, AccountProfile, Cadence, Money, OrderDetail, OrderSummary, SubscriptionAction, SubscriptionDetail, SubscriptionStatus, SubscriptionSummary } from "./types";

// Explicit projections from provider payloads. Anything not mapped here never leaves the server.

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const GID = /^gid:\/\/shopify\/(\w+)\/(\d{1,20})(?:\?.*)?$/;
export function numericId(gid: unknown, type: string): string {
  const match = typeof gid === "string" ? GID.exec(gid) : null;
  if (!match || match[1] !== type) throw new Error(`unexpected ${type} id`);
  return match[2];
}
export function gid(type: "Order" | "SubscriptionContract", id: string) {
  if (!/^\d{1,20}$/.test(id)) throw new Error("invalid id");
  return `gid://shopify/${type}/${id}`;
}
const text = (value: unknown) => typeof value === "string" ? value : "";
const maybe = (value: unknown) => typeof value === "string" && value ? value : null;
const money = (value: Raw | null | undefined): Money | null => value && typeof value.amount === "string" ? {amount: value.amount, currencyCode: text(value.currencyCode)} : null;
const image = (value: Raw | null | undefined) => maybe(value?.url);
// Only https links on Shopify-owned or tracking-carrier hosts reach the browser.
function httpsUrl(value: unknown): string | null {
  try { const url = new URL(String(value)); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}

/** Address ids may be CustomerAddress or MailingAddress GIDs (optionally with a query suffix). */
export function addressId(gidValue: unknown): string {
  const match = typeof gidValue === "string" ? GID.exec(gidValue) : null;
  if (!match || (match[1] !== "CustomerAddress" && match[1] !== "MailingAddress")) throw new Error("unexpected address id");
  return match[2];
}

export function mapAddress(raw: Raw | null | undefined, defaultId?: string | null): AccountAddress | null {
  if (!raw?.id) return null;
  const id = addressId(raw.id);
  return {
    id, firstName: text(raw.firstName), lastName: text(raw.lastName), company: text(raw.company), address1: text(raw.address1), address2: text(raw.address2),
    city: text(raw.city), province: text(raw.province), zoneCode: text(raw.zoneCode), country: text(raw.country), territoryCode: text(raw.territoryCode),
    zip: text(raw.zip), phoneNumber: text(raw.phoneNumber), formatted: Array.isArray(raw.formatted) ? raw.formatted.filter((l: unknown) => typeof l === "string") : [],
    isDefault: !!defaultId && raw.id === defaultId,
  };
}

export function mapOrderSummary(raw: Raw): OrderSummary {
  const nodes: Raw[] = raw.lineItems?.nodes || [];
  return {
    id: numericId(raw.id, "Order"), name: text(raw.name), processedAt: text(raw.processedAt), financialStatus: maybe(raw.financialStatus),
    fulfillmentStatus: text(raw.fulfillmentStatus), cancelled: !!raw.cancelledAt, totalPrice: money(raw.totalPrice) || {amount: "0", currencyCode: "USD"},
    items: nodes.slice(0, 4).map(n => ({title: text(n.title), quantity: Number(n.quantity) || 0, image: image(n.image), alt: text(n.image?.altText) || text(n.title)})),
    itemCount: nodes.reduce((sum, n) => sum + (Number(n.quantity) || 0), 0),
  };
}

export function mapOrderDetail(raw: Raw): OrderDetail {
  const lines: Raw[] = raw.lineItems?.nodes || [];
  return {
    ...mapOrderSummary(raw),
    confirmationNumber: maybe(raw.confirmationNumber), statusPageUrl: httpsUrl(raw.statusPageUrl), cancelReason: maybe(raw.cancelReason),
    subtotal: money(raw.subtotal), shipping: money(raw.totalShipping) || {amount: "0", currencyCode: text(raw.totalPrice?.currencyCode)}, tax: money(raw.totalTax),
    // Display only: an order's address is a snapshot, so its id is never parsed or used.
    shippingAddress: raw.shippingAddress ? {...mapAddress({...raw.shippingAddress, id: "gid://shopify/CustomerAddress/0"})!, id: "", isDefault: false} : null,
    lines: lines.map(n => ({id: text(n.id), title: text(n.title), variantTitle: maybe(n.variantTitle), quantity: Number(n.quantity) || 0, total: money(n.totalPrice), image: image(n.image), alt: text(n.image?.altText) || text(n.title)})),
    shipments: (raw.fulfillments?.nodes || []).map((f: Raw) => ({
      id: text(f.id), status: maybe(f.status), shipmentStatus: maybe(f.latestShipmentStatus), estimatedDeliveryAt: maybe(f.estimatedDeliveryAt),
      tracking: (f.trackingInformation || []).map((t: Raw) => ({company: maybe(t.company), number: maybe(t.number), url: httpsUrl(t.url)})),
    })),
  };
}

export function mapProfile(raw: Raw): AccountProfile {
  return {firstName: text(raw.firstName), lastName: text(raw.lastName), displayName: text(raw.displayName), email: maybe(raw.emailAddress?.emailAddress), phone: maybe(raw.phoneNumber?.phoneNumber)};
}

const STATUSES: SubscriptionStatus[] = ["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED", "FAILED", "STALE"];
const cadence = (raw: Raw | null | undefined): Cadence => ({interval: ["DAY", "WEEK", "MONTH", "YEAR"].includes(raw?.interval) ? raw!.interval : "MONTH", count: Number(raw?.intervalCount?.count) || 1});

/**
 * Which actions this site offers. When Shopify reports the contract is not eligible for customer
 * actions, none. When eligibility is not exposed to this client ("unknown"), status-appropriate
 * actions are offered and Shopify's own mutation result decides (its errors are shown verbatim).
 * A failed contract is never reactivated here because that would retry the same payment method.
 */
export function allowedActions(status: SubscriptionStatus, eligible: boolean | null): SubscriptionAction[] {
  if (eligible === false) return [];
  if (status === "ACTIVE") return ["pause", "skip", "unskip", "cancel"];
  if (status === "PAUSED") return ["resume", "cancel"];
  if (status === "FAILED") return ["cancel"];
  return [];
}

export function mapSubscriptionSummary(raw: Raw, managementUrl: string | null, extras?: Raw | null): SubscriptionSummary {
  const status: SubscriptionStatus = STATUSES.includes(raw.status) ? raw.status : "STALE";
  const eligible = typeof extras?.appEligibleForCustomerActions === "boolean" ? extras.appEligibleForCustomerActions as boolean : null;
  return {
    id: numericId(raw.id, "SubscriptionContract"), status, createdAt: text(raw.createdAt), nextBillingDate: maybe(raw.nextBillingDate), currencyCode: text(raw.currencyCode),
    managedBy: maybe(extras?.app?.title), lastPaymentFailed: raw.lastPaymentStatus === "FAILED", billing: cadence(raw.billingPolicy), delivery: cadence(raw.deliveryPolicy),
    lines: (raw.lines?.nodes || []).map((n: Raw) => ({id: text(n.id), title: text(n.title) || text(n.name), variantTitle: maybe(n.variantTitle), quantity: Number(n.quantity) || 0, price: money(n.currentPrice) || {amount: "0", currencyCode: text(raw.currencyCode)}, image: image(n.image), alt: text(n.image?.altText) || text(n.title)})),
    eligibility: eligible === null ? "unknown" : eligible ? "eligible" : "not_eligible",
    actions: allowedActions(status, eligible),
    managementUrl,
  };
}

function mailing(raw: Raw | null | undefined) {
  if (!raw) return [];
  return [text(raw.name), text(raw.address1), text(raw.address2), [text(raw.city), text(raw.province), text(raw.zip)].filter(Boolean).join(" "), text(raw.country)].filter(Boolean);
}

export function mapSubscriptionDetail(raw: Raw, managementUrl: string | null, extras?: Raw | null): SubscriptionDetail {
  const method = raw.deliveryMethod;
  const instrument = extras?.paymentInstrument;
  const payment: SubscriptionDetail["payment"] = !extras || !("paymentInstrument" in extras) ? {kind: "unavailable"} : !instrument ? null
    : instrument.__typename === "CustomerCreditCard" ? {kind: "card", brand: text(instrument.brand), lastDigits: text(instrument.lastDigits), expires: `${String(instrument.expiryMonth).padStart(2, "0")}/${String(instrument.expiryYear).slice(-2)}`, expiresSoon: !!instrument.expiresSoon}
    : instrument.__typename === "BankPaymentInstrument" ? {kind: "bank", bankName: text(instrument.bankName), lastDigits: text(instrument.lastDigits)}
    : {kind: "other"};
  return {
    ...mapSubscriptionSummary(raw, managementUrl, extras),
    deliveryPrice: money(raw.deliveryPrice) || {amount: "0", currencyCode: text(raw.currencyCode)},
    deliveryAddress: method?.address ? {lines: mailing(method.address), method: maybe(method.shippingOption?.presentmentTitle) || maybe(method.shippingOption?.title)} : null,
    pickup: maybe(method?.pickupOption?.title),
    payment,
    upcoming: (raw.upcomingBillingCycles?.nodes || []).map((c: Raw) => ({cycleIndex: Number(c.cycleIndex), date: text(c.billingAttemptExpectedDate), skipped: !!c.skipped, billed: c.status === "BILLED"})),
    orders: (raw.orders?.nodes || []).map((o: Raw) => ({id: numericId(o.id, "Order"), name: text(o.name), processedAt: text(o.processedAt)})),
  };
}

export function mapOverview(raw: Raw): AccountOverview {
  const contracts: Raw[] = raw.subscriptionContracts?.nodes || [];
  const active = contracts.filter(c => c.status === "ACTIVE");
  const next = active.map(c => c.nextBillingDate).filter((d): d is string => typeof d === "string").sort()[0] || null;
  return {
    profile: {...mapProfile(raw), memberSince: text(raw.creationDate)},
    defaultAddress: mapAddress(raw.defaultAddress, raw.defaultAddress?.id),
    recentOrders: (raw.orders?.nodes || []).map(mapOrderSummary),
    subscriptions: {active: active.length, paused: contracts.filter(c => c.status === "PAUSED").length, nextBillingDate: next},
  };
}
