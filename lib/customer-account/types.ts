// View models returned by /api/account/*. Shared with client components: no server imports.
// Ids are Shopify numeric ids of the signed-in customer's own records, never raw tokens.

export type Money = {amount: string; currencyCode: string};
export type AccountAddress = {
  id: string; firstName: string; lastName: string; company: string; address1: string; address2: string;
  city: string; province: string; zoneCode: string; country: string; territoryCode: string; zip: string; phoneNumber: string;
  formatted: string[]; isDefault: boolean;
};
export type OrderSummary = {
  id: string; name: string; processedAt: string; financialStatus: string | null; fulfillmentStatus: string; cancelled: boolean;
  totalPrice: Money; items: {title: string; quantity: number; image: string | null; alt: string}[]; itemCount: number;
};
export type OrderDetail = OrderSummary & {
  confirmationNumber: string | null; statusPageUrl: string | null; cancelReason: string | null;
  subtotal: Money | null; shipping: Money; tax: Money | null; shippingAddress: AccountAddress | null;
  lines: {id: string; title: string; variantTitle: string | null; quantity: number; total: Money | null; image: string | null; alt: string}[];
  shipments: {id: string; status: string | null; shipmentStatus: string | null; estimatedDeliveryAt: string | null; tracking: {company: string | null; number: string | null; url: string | null}[]}[];
};
export type Cadence = {interval: "DAY" | "WEEK" | "MONTH" | "YEAR"; count: number};
export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED" | "FAILED" | "STALE";
export type SubscriptionAction = "pause" | "resume" | "cancel" | "skip" | "unskip";
export type SubscriptionSummary = {
  id: string; status: SubscriptionStatus; createdAt: string; nextBillingDate: string | null; currencyCode: string;
  managedBy: string | null; lastPaymentFailed: boolean; billing: Cadence; delivery: Cadence;
  lines: {id: string; title: string; variantTitle: string | null; quantity: number; price: Money; image: string | null; alt: string}[];
  /** Provider's customer-action eligibility; "unknown" when Shopify does not expose it to this client. */
  eligibility: "eligible" | "not_eligible" | "unknown";
  /** Actions this site offers for this contract through the Customer Account API. */
  actions: SubscriptionAction[];
  /** Provider-hosted management page, when the merchant has published it. */
  managementUrl: string | null;
};
export type SubscriptionDetail = SubscriptionSummary & {
  deliveryPrice: Money;
  deliveryAddress: {lines: string[]; method: string | null} | null;
  pickup: string | null;
  /** "unavailable": Shopify did not expose the subscription's payment method to this site. */
  payment: {kind: "card"; brand: string; lastDigits: string; expires: string; expiresSoon: boolean} | {kind: "bank"; bankName: string; lastDigits: string} | {kind: "other"} | {kind: "unavailable"} | null;
  upcoming: {cycleIndex: number; date: string; skipped: boolean; billed: boolean}[];
  orders: {id: string; name: string; processedAt: string}[];
};
export type AccountProfile = {firstName: string; lastName: string; displayName: string; email: string | null; phone: string | null};
export type AccountOverview = {
  profile: AccountProfile & {memberSince: string};
  defaultAddress: AccountAddress | null;
  recentOrders: OrderSummary[];
  subscriptions: {active: number; paused: number; nextBillingDate: string | null};
};
export type SessionState =
  | {status: "signed_in"; csrf: string; firstName: string; email: string | null; hostedAccountUrl: string; subscriptionManagementUrl: string | null}
  | {status: "signed_out"}
  | {status: "not_configured"}
  | {status: "unavailable"};
export type ApiError = {error: "signed_out" | "not_configured" | "unavailable" | "not_found" | "invalid" | "forbidden" | "conflict"; message: string; fields?: Record<string, string>};
