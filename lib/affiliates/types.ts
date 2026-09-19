/**
 * Shared affiliate domain types.
 * Server-only consumers; safe to import types in tests.
 */

export interface BankInfo {
  accountHolder?: string;
  bankName?: string;
  routingNumber?: string;
  accountNumber?: string;
  accountType?: "checking" | "savings";
  country?: string;
  paypalEmail?: string;
  /** Zelle email or U.S. phone number. */
  zelle?: string;
  notes?: string;
}

export interface Affiliate {
  id: string;
  portalUserId?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** WhatsApp number (may match phone) — used to add affiliates to the group chat. */
  whatsapp?: string;
  promoCode: string;
  instagram?: string;
  tiktok?: string;
  website?: string;
  role: "affiliate" | "admin";
  status: "active" | "pending" | "disabled";
  /** Commission percent earned on a customer's first (coupon-attributed) order */
  commissionRate: number;
  /** Commission percent earned on recurring orders from returning customers */
  recurringCommissionRate: number;
  /** Shopify promo code percent discount shown to customers */
  couponRate: number;
  bankInfo?: BankInfo;
  referrerId?: string;
  referralCommissionRate?: number;
  /** Monthly sales target ($) that unlocks the bonus; unset = no bonus program. */
  bonusThreshold?: number;
  /** Bonus percent applied to the month's sales volume once the target is hit. */
  bonusRate?: number;
  /** Commission percent for Shopify supplements category orders. Null = not set / inactive. */
  supplementsCommissionRate?: number;
  /** Commission percent for Shopify skincare category orders. Null = not set / inactive. */
  skincareCommissionRate?: number;
  shopifyCustomerId?: number;
  reviewedAt?: string;
  /** Set once the affiliate completes the first-login welcome flow. */
  onboardedAt?: string;
  /** Personal one-time 70% coupon code for the affiliate's first order. */
  welcomeCouponCode?: string;
  notifyOnOrder?: boolean;
  notifyOnPayout?: boolean;
  notifyOnReferralAccepted?: boolean;
  createdAt: string;
}

export interface AffiliateOrderItem {
  productId?: number;
  name: string;
  quantity: number;
  unitPrice?: number;
  subtotal?: number;
  total?: number;
  imageUrl?: string;
  sku?: string;
}

export interface AffiliateOrder {
  id: string;
  affiliateId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  /** "bonus" rows are synthetic month-end sales-bonus commissions. */
  matchType: "code" | "recurring" | "referral" | "bonus";
  status: "pending" | "paid";
  payoutId?: string;
  sourceAffiliateId?: string;
  shopifyOrderId?: number;
  shopifyCustomerId?: number;
  items?: AffiliateOrderItem[];
  subtotal?: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  currency?: string;
  couponCode?: string;
  itemsSyncedAt?: string;
  createdAt: string;
}

export type PayoutMethod = "bank" | "paypal" | "zelle" | "other";

export interface Payout {
  id: string;
  affiliateId: string;
  amount: number;
  method: PayoutMethod;
  orderIds: string[];
  reference?: string;
  notes?: string;
  paidAt: string;
  createdAt: string;
}

export interface DateRange {
  start?: string;
  end?: string;
}

export interface ReferralBreakdown {
  refereeId: string;
  refereeName: string;
  refereePromoCode: string;
  refereeStatus: "active" | "pending" | "disabled";
  referralRate: number;
  ordersCount: number;
  totalCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

export interface AffiliateCustomer {
  key: string;
  email: string;
  name: string;
  affiliateId: string;
  totalSpent: number;
  totalCommission: number;
  orderCount: number;
  codeOrders: number;
  recurringOrders: number;
  firstOrderAt: string;
  lastOrderAt: string;
  isRecurring: boolean;
}

export interface AffiliateRanking {
  id: string;
  name: string;
  promoCode: string;
  totalSales: number;
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  orderCount: number;
}

export type Granularity = "day" | "week" | "month";

export interface TimeSeriesPoint {
  bucket: string;
  label: string;
  revenue: number;
  commission: number;
  orders: number;
}

export type PresetRange =
  | "1d"
  | "3d"
  | "7d"
  | "30d"
  | "90d"
  | "ytd"
  | "12m"
  | "all";

/**
 * A dashboard range selection: either a relative preset, or a calendar month
 * token of the form `m:YYYY-MM` (e.g. `m:2026-03` for March 2026).
 */
export type RangeValue = PresetRange | string;
