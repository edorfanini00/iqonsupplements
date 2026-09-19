/**
 * Affiliate data store — Postgres-backed persistence via Prisma.
 * Server-only. Never import from client code.
 */

import { randomBytes, createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { isDatabaseConfigured } from "@/lib/db/database";
import { prisma } from "@/lib/db/prisma";
import { validateReferrer, ReferralValidationError } from "@/lib/affiliates/referrals";
import {
  computeOrderCommissions,
  formatPromoCode,
  maskBankInfo,
  maskAccountNumber,
  round2,
} from "@/lib/affiliates/commission";
import { decryptBankInfo, encryptBankInfo } from "@/lib/affiliates/bank-crypto";
import {
  buildTimeSeries,
  presetToRange as presetToRangeImpl,
  resolveRange as resolveRangeImpl,
} from "@/lib/affiliates/time-series";
import type {
  Affiliate,
  AffiliateCustomer,
  AffiliateOrder,
  AffiliateOrderItem,
  AffiliateRanking,
  BankInfo,
  DateRange,
  Granularity,
  Payout,
  PayoutMethod,
  PresetRange,
  ReferralBreakdown,
  TimeSeriesPoint,
} from "@/lib/affiliates/types";

export type {
  Affiliate,
  AffiliateCustomer,
  AffiliateOrder,
  AffiliateOrderItem,
  AffiliateRanking,
  BankInfo,
  DateRange,
  Granularity,
  Payout,
  PayoutMethod,
  PresetRange,
  ReferralBreakdown,
  TimeSeriesPoint,
};

export {
  formatPromoCode,
  maskBankInfo,
  maskAccountNumber,
};

export function generateId(): string {
  return randomBytes(16).toString("hex");
}

function mapProfile(row: {
  id: string;
  portalUserId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  whatsapp: string | null;
  promoCode: string;
  instagram: string | null;
  tiktok: string | null;
  website: string | null;
  portalRole: string;
  status: string;
  commissionRate: number;
  recurringCommissionRate: number;
  couponRate: number;
  referrerId: string | null;
  referralCommissionRate: number | null;
  bonusThreshold: number | null;
  bonusRate: number | null;
  shopifyCustomerId: number | null;
  reviewedAt: Date | null;
  onboardedAt: Date | null;
  welcomeCouponCode: string | null;
  notifyOnOrder: boolean;
  notifyOnPayout: boolean;
  notifyOnReferralAccepted: boolean;
  createdAt: Date;
  bankAccount?: { encryptedPayload: string } | null;
}): Affiliate {
  let bankInfo: BankInfo | undefined;
  if (row.bankAccount?.encryptedPayload) {
    try {
      bankInfo = decryptBankInfo(row.bankAccount.encryptedPayload);
    } catch {
      bankInfo = undefined;
    }
  }

  return {
    id: row.id,
    portalUserId: row.portalUserId ?? undefined,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp ?? undefined,
    promoCode: row.promoCode,
    instagram: row.instagram ?? undefined,
    tiktok: row.tiktok ?? undefined,
    website: row.website ?? undefined,
    role: row.portalRole === "admin" ? "admin" : "affiliate",
    status: row.status as Affiliate["status"],
    commissionRate: row.commissionRate,
    recurringCommissionRate: row.recurringCommissionRate,
    couponRate: row.couponRate,
    bankInfo,
    referrerId: row.referrerId ?? undefined,
    referralCommissionRate: row.referralCommissionRate ?? undefined,
    bonusThreshold: row.bonusThreshold ?? undefined,
    bonusRate: row.bonusRate ?? undefined,
    // New fields — column may not exist in production until migration runs.
    supplementsCommissionRate: (row as unknown as { supplementsCommissionRate?: number | null }).supplementsCommissionRate ?? undefined,
    skincareCommissionRate: (row as unknown as { skincareCommissionRate?: number | null }).skincareCommissionRate ?? undefined,
    shopifyCustomerId: row.shopifyCustomerId ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    onboardedAt: row.onboardedAt?.toISOString(),
    welcomeCouponCode: row.welcomeCouponCode ?? undefined,
    notifyOnOrder: row.notifyOnOrder,
    notifyOnPayout: row.notifyOnPayout,
    notifyOnReferralAccepted: row.notifyOnReferralAccepted,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapOrder(row: {
  id: string;
  affiliateId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  commission: number;
  matchType: string;
  status: string;
  payoutId: string | null;
  sourceAffiliateId: string | null;
  shopifyOrderId: number | null;
  shopifyCustomerId: number | null;
  items: Prisma.JsonValue;
  subtotal: number | null;
  discountTotal: number | null;
  shippingTotal: number | null;
  taxTotal: number | null;
  currency: string | null;
  couponCode: string | null;
  itemsSyncedAt: Date | null;
  createdAt: Date;
}): AffiliateOrder {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    orderId: row.orderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    orderTotal: row.orderTotal,
    commission: row.commission,
    matchType: row.matchType as AffiliateOrder["matchType"],
    status: row.status as AffiliateOrder["status"],
    payoutId: row.payoutId ?? undefined,
    sourceAffiliateId: row.sourceAffiliateId ?? undefined,
    shopifyOrderId: row.shopifyOrderId ?? undefined,
    shopifyCustomerId: row.shopifyCustomerId ?? undefined,
    items: (row.items as AffiliateOrderItem[] | null) ?? undefined,
    subtotal: row.subtotal ?? undefined,
    discountTotal: row.discountTotal ?? undefined,
    shippingTotal: row.shippingTotal ?? undefined,
    taxTotal: row.taxTotal ?? undefined,
    currency: row.currency ?? undefined,
    couponCode: row.couponCode ?? undefined,
    itemsSyncedAt: row.itemsSyncedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPayout(row: {
  id: string;
  affiliateId: string;
  amount: number;
  method: string;
  reference: string | null;
  notes: string | null;
  paidAt: Date;
  createdAt: Date;
  items?: { orderId: string }[];
  orders?: { id: string }[];
}): Payout {
  const orderIds =
    row.items?.map((i) => i.orderId) ??
    row.orders?.map((o) => o.id) ??
    [];
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    amount: row.amount,
    method: row.method as PayoutMethod,
    orderIds,
    reference: row.reference ?? undefined,
    notes: row.notes ?? undefined,
    paidAt: row.paidAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const profileInclude = { bankAccount: true } as const;

export async function getAllAffiliates(): Promise<Affiliate[]> {
  const rows = await prisma.affiliateProfile.findMany({
    include: profileInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapProfile);
}

export async function getAffiliateById(id: string): Promise<Affiliate | null> {
  const row = await prisma.affiliateProfile.findUnique({
    where: { id },
    include: profileInclude,
  });
  return row ? mapProfile(row) : null;
}

export async function getAffiliateByEmail(email: string): Promise<Affiliate | null> {
  if (!isDatabaseConfigured()) return null;
  const row = await prisma.affiliateProfile.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: profileInclude,
  });
  return row ? mapProfile(row) : null;
}

export async function getAffiliateByPortalUserId(portalUserId: number): Promise<Affiliate | null> {
  if (!isDatabaseConfigured()) return null;
  const row = await prisma.affiliateProfile.findUnique({
    where: { portalUserId },
    include: profileInclude,
  });
  return row ? mapProfile(row) : null;
}

export async function getAffiliateByUsername(username: string): Promise<Affiliate | null> {
  const lower = username.toLowerCase();
  const row = await prisma.affiliateProfile.findFirst({
    where: {
      OR: [
        { email: { equals: lower, mode: "insensitive" as const } },
        { promoCode: { equals: lower, mode: "insensitive" as const } },
        { firstName: { equals: lower, mode: "insensitive" as const } },
      ],
    },
    include: profileInclude,
  });
  return row ? mapProfile(row) : null;
}

export async function getAffiliateByPromoCode(code: string): Promise<Affiliate | null> {
  // Normalize defensively: Shopify lowercases coupon codes, and coupon
  // strings can arrive with stray whitespace. promo_code is stored uppercased
  // and trimmed, so match on the same normalized form.
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return null;
  const row = await prisma.affiliateProfile.findUnique({
    where: { promoCode: normalized },
    include: profileInclude,
  });
  return row ? mapProfile(row) : null;
}

export async function isPromoCodeTaken(code: string): Promise<boolean> {
  const count = await prisma.affiliateProfile.count({
    where: { promoCode: { equals: code, mode: "insensitive" as const } },
  });
  return count > 0;
}

/** Number of affiliate applications awaiting review (cheap count for badges). */
export async function countPendingAffiliates(): Promise<number> {
  return prisma.affiliateProfile.count({
    where: { portalRole: "affiliate", status: "pending" },
  });
}

export interface AffiliateDirectoryEntry {
  id: string;
  name: string;
  email: string;
  promoCode: string;
  status: string;
  role: "admin" | "affiliate";
}

/**
 * Minimal affiliate roster (id/name/email/promo/status) for pickers and name
 * lookups. Selects only the columns needed — no bank-account include — so it's a
 * single cheap query, and it's intended to be fetched once per page load rather
 * than on every poll.
 */
export async function listAffiliateDirectory(): Promise<AffiliateDirectoryEntry[]> {
  const rows = await prisma.affiliateProfile.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      promoCode: true,
      status: true,
      portalRole: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    promoCode: r.promoCode,
    status: r.status,
    role: r.portalRole === "admin" ? "admin" : "affiliate",
  }));
}

/**
 * Typeahead search over active affiliates by name or promo code. Used on the
 * public signup form so applicants can pick the affiliate who referred them.
 * Returns a minimal shape (never exposes contact details) and requires a query
 * so it never dumps the full roster.
 */
export async function searchActiveAffiliates(
  query: string,
  limit = 8
): Promise<Array<{ id: string; name: string; promoCode: string }>> {
  const q = query.trim();
  if (q.length < 2) return [];

  const mode = "insensitive" as const;
  const tokens = q.split(/\s+/).filter(Boolean);
  const or: Array<Record<string, unknown>> = [
    { firstName: { contains: q, mode } },
    { lastName: { contains: q, mode } },
    { promoCode: { contains: q, mode } },
  ];
  if (tokens.length >= 2) {
    or.push({
      AND: [
        { firstName: { contains: tokens[0], mode } },
        { lastName: { contains: tokens[tokens.length - 1], mode } },
      ],
    });
  }

  const rows = await prisma.affiliateProfile.findMany({
    where: {
      status: "active",
      portalRole: "affiliate",
      OR: or,
    },
    take: limit,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    promoCode: r.promoCode,
  }));
}

/**
 * Every active affiliate, for the "who referred you?" picker in the mobile app.
 * Unlike searchActiveAffiliates this returns the whole roster, because the app
 * lets the user browse rather than guess a name. Social handles are included so
 * a user who only knows the creator from Instagram or TikTok can still identify
 * them. Contact details are never exposed.
 */
export async function listActiveAffiliateRoster(): Promise<
  Array<{
    id: string;
    name: string;
    promoCode: string;
    instagram: string | null;
    tiktok: string | null;
  }>
> {
  const rows = await prisma.affiliateProfile.findMany({
    where: { status: "active", portalRole: "affiliate" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      promoCode: true,
      instagram: true,
      tiktok: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    promoCode: r.promoCode,
    instagram: normalizeHandle(r.instagram),
    tiktok: normalizeHandle(r.tiktok),
  }));
}

// Affiliates enter socials inconsistently — bare handles, @handles, or full
// profile URLs. The picker only ever shows "@handle", so reduce them all to it.
function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "")
    .trim();
  return handle || null;
}

export async function createAffiliate(
  data: Omit<Affiliate, "id" | "createdAt" | "recurringCommissionRate"> & {
    recurringCommissionRate?: number;
    passwordHash?: string;
  }
): Promise<Affiliate> {
  const row = await prisma.affiliateProfile.create({
    data: {
      portalUserId: data.portalUserId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase().trim(),
      phone: data.phone ?? "",
      whatsapp: data.whatsapp,
      promoCode: data.promoCode.trim().toUpperCase(),
      instagram: data.instagram,
      tiktok: data.tiktok,
      website: data.website,
      portalRole: data.role,
      status: data.status,
      commissionRate: data.commissionRate,
      recurringCommissionRate: data.recurringCommissionRate ?? 20,
      couponRate: data.couponRate,
      referrerId: data.referrerId,
      referralCommissionRate: data.referralCommissionRate,
      bonusThreshold: data.bonusThreshold,
      bonusRate: data.bonusRate,
      shopifyCustomerId: data.shopifyCustomerId,
      reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : undefined,
      notifyOnOrder: data.notifyOnOrder ?? true,
      notifyOnPayout: data.notifyOnPayout ?? true,
      notifyOnReferralAccepted: data.notifyOnReferralAccepted ?? true,
    },
    include: profileInclude,
  });

  if (data.bankInfo) {
    await updateAffiliateBankInfo(row.id, data.bankInfo);
    const refreshed = await getAffiliateById(row.id);
    return refreshed ?? mapProfile(row);
  }

  return mapProfile(row);
}

export async function updateAffiliate(
  id: string,
  updates: Partial<Omit<Affiliate, "referrerId">> & { referrerId?: string | null }
): Promise<Affiliate | null> {
  for (const key of ["commissionRate","recurringCommissionRate","couponRate","referralCommissionRate","bonusRate"] as const) {
    const value=updates[key]; if(value!=null && (!Number.isFinite(value)||value<0||value>100)) throw new ReferralValidationError("Rates must be between 0 and 100%.");
  }
  if(updates.status && !["active","pending","disabled"].includes(updates.status))throw new ReferralValidationError("Invalid account status.");
  if(updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email))throw new ReferralValidationError("Invalid email.");
  return prisma.$transaction(async tx=>{
    if(updates.referrerId!==undefined){
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(714206, 1)`;
      await validateReferrer(id,updates.referrerId??null,refId=>tx.affiliateProfile.findUnique({where:{id:refId}}));
    }
    return updateAffiliateWithClient(id,updates,tx);
  });
}

async function updateAffiliateWithClient(
  id: string,
  updates: Partial<Omit<Affiliate, "referrerId">> & { referrerId?: string | null },
  client: Pick<typeof prisma, "affiliateProfile" | "affiliateBankAccount" | "portalAccount" | "portalSession">,
): Promise<Affiliate | null> {
  const existing = await client.affiliateProfile.findUnique({ where: { id } });
  if (!existing) return null;

  if(existing.portalUserId && (updates.email!==undefined||updates.status!==undefined||updates.role!==undefined)){
    await client.portalAccount.update({where:{id:existing.portalUserId},data:{email:updates.email?.toLowerCase().trim(),disabled:updates.status===undefined?undefined:updates.status==="disabled",role:updates.role}});
    if(updates.status==="disabled"||updates.email||updates.role)await client.portalSession.deleteMany({where:{accountId:existing.portalUserId}});
  }
  const { bankInfo, role, reviewedAt, onboardedAt, createdAt: _c, id: _id, supplementsCommissionRate: _suppRate, skincareCommissionRate: _skinRate, ...rest } = updates;
  const hasCatRates = _suppRate !== undefined || _skinRate !== undefined;
  const suppRate = typeof _suppRate === 'number' ? _suppRate : null;
  const skinRate = typeof _skinRate === 'number' ? _skinRate : null;

  const row = await client.affiliateProfile.update({
    where: { id },
    data: {
      ...rest,
      email: rest.email?.toLowerCase().trim(),
      promoCode: rest.promoCode?.toUpperCase(),
      portalRole: role,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : undefined,
      onboardedAt: onboardedAt ? new Date(onboardedAt) : undefined,
    },
    include: profileInclude,
  });

  if (bankInfo) {
    return updateAffiliateBankInfo(id, bankInfo, client);
  }

  // Write new category rates via raw SQL — column may not exist until migration runs.
  if (hasCatRates) {
    try {
      if (_suppRate !== undefined && _skinRate !== undefined) {
        await prisma.$executeRaw`UPDATE supplements_affiliate_profiles SET supplements_commission_rate=${suppRate}, skincare_commission_rate=${skinRate} WHERE id=${id}`;
      } else if (_suppRate !== undefined) {
        await prisma.$executeRaw`UPDATE supplements_affiliate_profiles SET supplements_commission_rate=${suppRate} WHERE id=${id}`;
      } else {
        await prisma.$executeRaw`UPDATE supplements_affiliate_profiles SET skincare_commission_rate=${skinRate} WHERE id=${id}`;
      }
    } catch { /* column not yet created — will apply after migration */ }
  }

  return mapProfile(row);
}

/**
 * Assign, reassign, or remove an affiliate's referrer — works at any point,
 * including after the affiliate was approved. Future orders credit the new
 * referrer; already-recorded commission rows are untouched.
 */
export async function setAffiliateReferrer(
  id: string,
  referrerId: string | null,
  referralCommissionRate?: number
): Promise<Affiliate | null> {
  return updateAffiliate(id, { referrerId, ...(referralCommissionRate != null ? { referralCommissionRate } : {}) });
}

export async function updateAffiliateBankInfo(
  id: string,
  bankInfo: BankInfo,
  client: Pick<typeof prisma, "affiliateProfile" | "affiliateBankAccount"> = prisma,
): Promise<Affiliate | null> {
  const affiliate = await client.affiliateProfile.findUnique({ where: { id } });
  if (!affiliate) return null;

  const { payload, last4 } = encryptBankInfo(bankInfo);
  await client.affiliateBankAccount.upsert({
    where: { affiliateId: id },
    create: {
      affiliateId: id,
      encryptedPayload: payload,
      last4,
      country: bankInfo.country,
    },
    update: {
      encryptedPayload: payload,
      last4,
      country: bankInfo.country,
    },
  });

  const refreshed = await client.affiliateProfile.findUnique({ where: { id }, include: profileInclude });
  return refreshed ? mapProfile(refreshed) : null;
}

export async function linkAffiliateToPortalUser(
  affiliateId: string,
  portalUserId: number
): Promise<Affiliate | null> {
  return updateAffiliate(affiliateId, { portalUserId });
}

export async function deleteAffiliate(id:string):Promise<boolean>{
  const existing=await getAffiliateById(id);if(!existing)return false;
  await updateAffiliate(id,{status:"disabled"});
  return true;
}

export async function getOrdersForAffiliate(affiliateId: string): Promise<AffiliateOrder[]> {
  const rows = await prisma.affiliateOrder.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapOrder);
}

export async function getAllOrders(): Promise<AffiliateOrder[]> {
  const rows = await prisma.affiliateOrder.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(mapOrder);
}

export async function addAffiliateOrder(
  data: Omit<AffiliateOrder, "id" | "createdAt"> & { createdAt?: string }
): Promise<AffiliateOrder> {
  const row = await prisma.affiliateOrder.create({
    data: {
      affiliateId: data.affiliateId,
      orderId: data.orderId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      orderTotal: data.orderTotal,
      commission: data.commission,
      matchType: data.matchType,
      status: data.status,
      payoutId: data.payoutId,
      sourceAffiliateId: data.sourceAffiliateId,
      shopifyOrderId: data.shopifyOrderId,
      shopifyCustomerId: data.shopifyCustomerId,
      items: data.items as unknown as Prisma.InputJsonValue,
      subtotal: data.subtotal,
      discountTotal: data.discountTotal,
      shippingTotal: data.shippingTotal,
      taxTotal: data.taxTotal,
      currency: data.currency,
      couponCode: data.couponCode,
      itemsSyncedAt: data.itemsSyncedAt ? new Date(data.itemsSyncedAt) : undefined,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    },
  });
  return mapOrder(row);
}

export async function recordOrderWithReferral(input: {
  affiliateId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  orderTotal: number;
  /** Subtotal after coupon discount, before shipping + tax — the commission base. */
  commissionBase?: number;
  matchType: "code" | "recurring";
  shopifyOrderId?: number;
  shopifyCustomerId?: number;
  createdAt?: string;
  items?: AffiliateOrderItem[];
  subtotal?: number;
  discountTotal?: number;
  shippingTotal?: number;
  taxTotal?: number;
  currency?: string;
  couponCode?: string;
}): Promise<{ primary: AffiliateOrder; referral?: AffiliateOrder }> {
  const affiliate = await getAffiliateById(input.affiliateId);
  if (!affiliate) throw new Error("Affiliate not found");

  const referrer = affiliate.referrerId
    ? await getAffiliateById(affiliate.referrerId)
    : null;

  const commissions = computeOrderCommissions({
    orderTotal: input.orderTotal,
    commissionBase: input.commissionBase,
    commissionRate: affiliate.commissionRate,
    matchType: input.matchType,
    recurringCommissionRate: affiliate.recurringCommissionRate,
    referrerId: affiliate.referrerId,
    referralCommissionRate: affiliate.referralCommissionRate,
    referrerActive: referrer?.status === "active",
  });

  const sharedCart = {
    items: input.items as unknown as Prisma.InputJsonValue | undefined,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    shippingTotal: input.shippingTotal,
    taxTotal: input.taxTotal,
    currency: input.currency,
    couponCode: input.couponCode,
    itemsSyncedAt: input.items ? new Date() : undefined,
  };

  const primary = await addAffiliateOrder({
    affiliateId: affiliate.id,
    orderId: input.orderId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    orderTotal: input.orderTotal,
    commission: commissions.primaryCommission,
    matchType: input.matchType,
    status: "pending",
    shopifyOrderId: input.shopifyOrderId,
    shopifyCustomerId: input.shopifyCustomerId,
    createdAt: input.createdAt,
    items: input.items,
    subtotal: input.subtotal,
    discountTotal: input.discountTotal,
    shippingTotal: input.shippingTotal,
    taxTotal: input.taxTotal,
    currency: input.currency,
    couponCode: input.couponCode,
    itemsSyncedAt: input.items ? new Date().toISOString() : undefined,
  });

  let referral: AffiliateOrder | undefined;
  if (referrer && commissions.referralCommission != null) {
    referral = await addAffiliateOrder({
      affiliateId: referrer.id,
      orderId: input.orderId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      orderTotal: input.orderTotal,
      commission: commissions.referralCommission,
      matchType: "referral",
      status: "pending",
      sourceAffiliateId: affiliate.id,
      shopifyOrderId: input.shopifyOrderId,
      shopifyCustomerId: input.shopifyCustomerId,
      createdAt: input.createdAt,
      items: input.items,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      shippingTotal: input.shippingTotal,
      taxTotal: input.taxTotal,
      currency: input.currency,
      couponCode: input.couponCode,
      itemsSyncedAt: input.items ? new Date().toISOString() : undefined,
    });
  }

  return { primary, referral };
}

/** Every commission row (primary + referral, any status) for a Shopify order. */
export async function getAffiliateOrdersForShopifyId(
  shopifyOrderId: number
): Promise<AffiliateOrder[]> {
  const rows = await prisma.affiliateOrder.findMany({
    where: { shopifyOrderId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapOrder);
}

export async function getOrderByShopifyId(
  shopifyOrderId: number,
  affiliateId?: string
): Promise<AffiliateOrder | null> {
  const row = await prisma.affiliateOrder.findFirst({
    where: {
      shopifyOrderId,
      ...(affiliateId ? { affiliateId } : {}),
      matchType: affiliateId ? undefined : { in: ["code", "recurring"] },
    },
    orderBy: { createdAt: "asc" },
  });
  return row ? mapOrder(row) : null;
}

/**
 * Remove not-yet-paid-out commission rows (primary + referral) for a Shopify order
 * that is no longer in a paid status (cancelled, refunded, failed, on hold).
 * Rows already settled in a payout are left untouched. Returns rows removed.
 */
/**
 * Remove a single un-paid (pending) commission entry by its id — used when an
 * admin needs to drop one order from what they owe an affiliate (e.g. a refund
 * or a mistaken attribution). Rows already settled in a payout are protected.
 * Returns true when a pending row was removed.
 */
export async function voidPendingAffiliateOrder(id: string): Promise<boolean> {
  const res = await prisma.affiliateOrder.deleteMany({
    where: { id, status: "pending" },
  });
  return res.count === 1;
}

export async function voidPendingOrdersForShopifyOrder(shopifyOrderId: number): Promise<number> {
  const res = await prisma.affiliateOrder.deleteMany({
    where: { shopifyOrderId, status: "pending" },
  });
  return res.count;
}

export async function hasPrimaryShopifyOrder(shopifyOrderId: number): Promise<boolean> {
  const count = await prisma.affiliateOrder.count({
    where: {
      shopifyOrderId,
      matchType: { in: ["code", "recurring"] },
    },
  });
  return count > 0;
}

export async function getAffiliateOrderById(id: string): Promise<AffiliateOrder | null> {
  const row = await prisma.affiliateOrder.findUnique({ where: { id } });
  return row ? mapOrder(row) : null;
}

export async function getAffiliateOrdersByIds(
  ids: string[]
): Promise<AffiliateOrder[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.affiliateOrder.findMany({
    where: { id: { in: ids } },
  });
  return rows.map(mapOrder);
}

export async function updateCartSnapshotForShopifyOrder(
  shopifyOrderId: number,
  snapshot: {
    items?: AffiliateOrderItem[];
    subtotal?: number;
    discountTotal?: number;
    shippingTotal?: number;
    taxTotal?: number;
    currency?: string;
    couponCode?: string;
  }
): Promise<void> {
  await prisma.affiliateOrder.updateMany({
    where: { shopifyOrderId },
    data: {
      items: snapshot.items as unknown as Prisma.InputJsonValue,
      subtotal: snapshot.subtotal,
      discountTotal: snapshot.discountTotal,
      shippingTotal: snapshot.shippingTotal,
      taxTotal: snapshot.taxTotal,
      currency: snapshot.currency,
      couponCode: snapshot.couponCode,
      itemsSyncedAt: new Date(),
    },
  });
}

export async function findRecurringAffiliateForCustomer(
  customerEmail: string,
  customerName?: string
): Promise<Affiliate | null> {
  const email = customerEmail.trim().toLowerCase();
  const name = customerName?.trim().toLowerCase();

  const seed = await prisma.affiliateOrder.findFirst({
    where: {
      matchType: "code",
      OR: [
        { customerEmail: { equals: email, mode: "insensitive" as const } },

      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return seed ? getAffiliateById(seed.affiliateId) : null;
}

export async function recordWebhookEvent(input: {
  provider: string;
  externalId: string;
  payloadHash?: string;
  result?: string;
}): Promise<boolean> {
  try {
    await prisma.affiliateWebhookEvent.create({
      data: {
        provider: input.provider,
        externalId: input.externalId,
        payloadHash: input.payloadHash,
        result: input.result,
        processedAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAllPayouts(): Promise<Payout[]> {
  const rows = await prisma.affiliatePayout.findMany({
    include: { items: true },
    orderBy: { paidAt: "desc" },
  });
  return rows.map(mapPayout);
}

export async function getPayoutsForAffiliate(affiliateId: string): Promise<Payout[]> {
  const rows = await prisma.affiliatePayout.findMany({
    where: { affiliateId },
    include: { items: true },
    orderBy: { paidAt: "desc" },
  });
  return rows.map(mapPayout);
}

export class PayoutValidationError extends Error {}

export async function recordPayout(input: {
  affiliateId: string;
  amount?: number;
  method: PayoutMethod;
  orderIds?: string[];
  reference?: string;
  notes?: string;
  paidAt?: string;
  createdByPortalUserId?: number;
}): Promise<Payout> {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.affiliateOrder.findMany({
      where: { affiliateId: input.affiliateId, status: "pending", payoutId: null },
    });
    const ids = [...new Set([...(input.orderIds ?? pending.map(o => o.id)), ...pending.filter(o => o.commission < 0).map(o => o.id)])];
    if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !pending.some(o => o.id === id))) {
      throw new PayoutValidationError("Select unpaid earnings belonging to this affiliate");
    }
    const amount = round2(pending.filter(o => ids.includes(o.id)).reduce((sum, o) => sum + o.commission, 0));
    if (!Number.isFinite(amount) || amount <= 0 || (input.amount !== undefined && (!Number.isFinite(input.amount) || Math.abs(input.amount - amount) > 0.000001))) {
      throw new PayoutValidationError("Payout amount must equal selected unpaid earnings");
    }
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    if (!Number.isFinite(paidAt.getTime())) throw new PayoutValidationError("Invalid payment date");
    const created = await tx.affiliatePayout.create({ data: {
      affiliateId: input.affiliateId, amount, method: input.method,
      reference: input.reference, notes: input.notes, paidAt,
      createdByPortalUserId: input.createdByPortalUserId,
    } });
    const claimed = await tx.affiliateOrder.updateMany({
      where: { id: { in: ids }, affiliateId: input.affiliateId, status: "pending", payoutId: null },
      data: { status: "paid", payoutId: created.id },
    });
    if (claimed.count !== ids.length) throw new PayoutValidationError("Earnings changed or were already paid; refresh and retry");
    await tx.affiliatePayoutItem.createMany({ data: ids.map(orderId => ({ payoutId: created.id, orderId })) });
    return mapPayout({ ...created, items: ids.map(orderId => ({ orderId })) });
  }, { isolationLevel: "Serializable" });
}

export async function reversePayout(payoutId: string): Promise<boolean> {
  const payout = await prisma.affiliatePayout.findUnique({
    where: { id: payoutId },
    include: { items: true },
  });
  if (!payout) return false;

  await prisma.$transaction(async (tx) => {
    await tx.affiliateOrder.updateMany({
      where: { payoutId },
      data: { status: "pending", payoutId: null },
    });
    await tx.affiliatePayoutItem.deleteMany({ where: { payoutId } });
    await tx.affiliatePayout.delete({ where: { id: payoutId } });
  });

  return true;
}

function inRange(iso: string, range?: DateRange): boolean {
  if (!range) return true;
  const t = new Date(iso).getTime();
  if (range.start && t < new Date(range.start).getTime()) return false;
  if (range.end && t > new Date(range.end).getTime()) return false;
  return true;
}

export async function getAffiliateStats(affiliateId: string, range?: DateRange) {
  const orders = (await getOrdersForAffiliate(affiliateId)).filter((o) =>
    inRange(o.createdAt, range)
  );
  const payouts = (await getPayoutsForAffiliate(affiliateId)).filter((p) =>
    inRange(p.paidAt, range)
  );

  const directOrders = orders.filter(
    (o) => o.matchType === "code" || o.matchType === "recurring"
  );
  const referralEntries = orders.filter((o) => o.matchType === "referral");

  // Synthetic month-end bonus rows carry commission but are not real orders,
  // so they're excluded from order counts and revenue.
  const totalOrders = orders.filter((o) => o.matchType !== "bonus").length;
  const totalRevenue = directOrders.reduce((sum, o) => sum + o.orderTotal, 0);
  const totalCommission = orders.reduce((sum, o) => sum + o.commission, 0);
  const pendingCommission = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + o.commission, 0);
  const paidCommission = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.commission, 0);
  const referralCommission = referralEntries.reduce((sum, o) => sum + o.commission, 0);

  return {
    totalOrders,
    totalRevenue,
    totalCommission,
    directCommission: totalCommission - referralCommission,
    pendingCommission,
    paidCommission,
    codeOrders: orders.filter((o) => o.matchType === "code").length,
    recurringOrders: orders.filter((o) => o.matchType === "recurring").length,
    referralOrders: referralEntries.length,
    referralCommission,
    referralCommissionPending: referralEntries
      .filter((o) => o.status === "pending")
      .reduce((sum, o) => sum + o.commission, 0),
    referralCommissionPaid: referralEntries
      .filter((o) => o.status === "paid")
      .reduce((sum, o) => sum + o.commission, 0),
    totalPayouts: payouts.length,
    totalPaidOut: payouts.reduce((sum, p) => sum + p.amount, 0),
  };
}

/** Current direct recruits, with lifetime recorded store sales (not referral earnings).
 * Excludes referral mirrors, synthetic/app commissions, and known voided rows.
 * Reassignment changes membership, never historical commission attribution.
 */
export async function getRecruitmentNetwork(referrerId: string) {
  const recruits = await prisma.affiliateProfile.findMany({
    where: { referrerId, portalRole: "affiliate" },
    select: { id: true, firstName: true, lastName: true, promoCode: true, status: true, createdAt: true, commissionRate: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  const orders = recruits.length ? await prisma.affiliateOrder.findMany({
    where: { affiliateId: { in: recruits.map(r => r.id) }, matchType: { in: ["code", "recurring"] }, status: { not: "voided" } },
    select: { affiliateId: true, matchType: true, status: true, orderTotal: true },
  }) : [];
  const totals = new Map<string, { revenue: number; count: number }>();
  for (const order of orders) {
    if (order.status === "voided" || !["code", "recurring"].includes(order.matchType)) continue;
    const total = totals.get(order.affiliateId) ?? { revenue: 0, count: 0 };
    total.revenue += order.orderTotal;
    total.count += 1;
    totals.set(order.affiliateId, total);
  }
  const referees = recruits.map(r => ({
    id: r.id, name: `${r.firstName} ${r.lastName}`.trim(), promoCode: r.promoCode,
    status: r.status, createdAt: r.createdAt.toISOString(), commissionRate: r.commissionRate,
    storeRevenue: round2(totals.get(r.id)?.revenue ?? 0), orderCount: totals.get(r.id)?.count ?? 0,
  }));
  return { referees, directRecruits: referees.length, storeRevenue: round2(referees.reduce((sum, r) => sum + r.storeRevenue, 0)) };
}

export async function getReferralBreakdownForAffiliate(
  referrerId: string,
  range?: DateRange
): Promise<ReferralBreakdown[]> {
  const referees = await getRefereesForAffiliate(referrerId);
  const allOrders = await getOrdersForAffiliate(referrerId);

  return referees
    .map((referee) => {
      const referralOrders = allOrders.filter(
        (o) =>
          o.matchType === "referral" &&
          o.sourceAffiliateId === referee.id &&
          inRange(o.createdAt, range)
      );
      return {
        refereeId: referee.id,
        refereeName: `${referee.firstName} ${referee.lastName}`.trim(),
        refereePromoCode: referee.promoCode,
        refereeStatus: referee.status,
        referralRate: referee.referralCommissionRate ?? 0,
        ordersCount: referralOrders.length,
        totalCommission: referralOrders.reduce((s, o) => s + o.commission, 0),
        pendingCommission: referralOrders
          .filter((o) => o.status === "pending")
          .reduce((s, o) => s + o.commission, 0),
        paidCommission: referralOrders
          .filter((o) => o.status === "paid")
          .reduce((s, o) => s + o.commission, 0),
      };
    })
    .sort((a, b) => b.totalCommission - a.totalCommission);
}

export async function getAdminStats(range?: DateRange) {
  const everyone = await getAllAffiliates();
  const affiliates = everyone.filter((a) => a.role === "affiliate");
  // House (admin) referral commissions stay in-house: they're never paid out,
  // so they must not count toward commission costs or the pending balance.
  const adminIds = new Set(
    everyone.filter((a) => a.role === "admin").map((a) => a.id)
  );
  const allOrders = await getAllOrders();
  const orders = allOrders.filter((o) => inRange(o.createdAt, range));
  const payouts = (await getAllPayouts()).filter((p) => inRange(p.paidAt, range));
  // A single sale can produce a primary row plus a "referral" mirror row for the
  // referrer's commission. Count the actual customer sale once for revenue/order
  // attribution by excluding referral rows. Synthetic month-end "bonus" rows
  // are commissions only, never sales.
  const directOrders = orders.filter(
    (o) => o.matchType === "code" || o.matchType === "recurring"
  );

  return {
    totalAffiliates: affiliates.length,
    activeAffiliates: affiliates.filter((a) => a.status === "active").length,
    totalOrders: orders.filter((o) => o.matchType !== "bonus").length,
    // Deduped like affiliateRevenue: referral mirror rows repeat the same
    // customer sale's total and must not inflate revenue.
    totalRevenue: directOrders.reduce((sum, o) => sum + o.orderTotal, 0),
    // Affiliate-attributed sales, deduped — used for the "from affiliates"
    // breakout against total store revenue.
    affiliateOrders: directOrders.length,
    affiliateRevenue: directOrders.reduce((sum, o) => sum + o.orderTotal, 0),
    totalCommissions: orders
      .filter((o) => !adminIds.has(o.affiliateId))
      .reduce((sum, o) => sum + o.commission, 0),
    totalPaid: payouts.reduce((sum, p) => sum + p.amount, 0),
    // Pending commission is a live balance — everything owed right now,
    // regardless of the selected date range.
    totalPending: allOrders
      .filter((o) => o.status === "pending" && !adminIds.has(o.affiliateId))
      .reduce((sum, o) => sum + o.commission, 0),
  };
}

export async function getCustomersForAffiliate(
  affiliateId: string
): Promise<AffiliateCustomer[]> {
  const orders = (await getOrdersForAffiliate(affiliateId)).filter(
    (o) => o.matchType === "code" || o.matchType === "recurring"
  );
  const map = new Map<string, AffiliateCustomer>();

  for (const o of orders) {
    const key = (o.customerEmail || o.customerName).trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.totalSpent += o.orderTotal;
      existing.totalCommission += o.commission;
      existing.orderCount += 1;
      if (o.matchType === "code") existing.codeOrders += 1;
      if (o.matchType === "recurring") existing.recurringOrders += 1;
      if (new Date(o.createdAt).getTime() < new Date(existing.firstOrderAt).getTime()) {
        existing.firstOrderAt = o.createdAt;
      }
      if (new Date(o.createdAt).getTime() > new Date(existing.lastOrderAt).getTime()) {
        existing.lastOrderAt = o.createdAt;
      }
      existing.isRecurring = existing.orderCount > 1;
    } else {
      map.set(key, {
        key,
        email: o.customerEmail,
        name: o.customerName,
        affiliateId,
        totalSpent: o.orderTotal,
        totalCommission: o.commission,
        orderCount: 1,
        codeOrders: o.matchType === "code" ? 1 : 0,
        recurringOrders: o.matchType === "recurring" ? 1 : 0,
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
        isRecurring: false,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * Sort orders most-recent-first. Primary key is the order date, but when those
 * tie (e.g. several orders ingested in the same bulk sync share a timestamp) we
 * fall back to the numeric order number, which always increases over time — so
 * the newest order reliably comes first even when timestamps collide.
 */
function compareOrdersNewestFirst(a: AffiliateOrder, b: AffiliateOrder): number {
  const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (byDate !== 0) return byDate;
  const aNum = a.shopifyOrderId ?? (parseInt(a.orderId, 10) || 0);
  const bNum = b.shopifyOrderId ?? (parseInt(b.orderId, 10) || 0);
  return bNum - aNum;
}

export async function getOrdersForCustomer(
  affiliateId: string,
  customerKey: string
): Promise<AffiliateOrder[]> {
  const lower = customerKey.toLowerCase();
  return (await getOrdersForAffiliate(affiliateId))
    .filter(
      (o) =>
        (o.matchType === "code" || o.matchType === "recurring") &&
        (o.customerEmail || o.customerName).trim().toLowerCase() === lower
    )
    .sort(compareOrdersNewestFirst);
}

export async function getRefereesForAffiliate(referrerId: string): Promise<Affiliate[]> {
  const rows = await prisma.affiliateProfile.findMany({
    where: { referrerId },
    include: profileInclude,
  });
  return rows.map(mapProfile);
}

export async function getAffiliateRanking(range?: DateRange): Promise<AffiliateRanking[]> {
  const affiliates = (await getAllAffiliates()).filter((a) => a.role === "affiliate");
  const orders = (await getAllOrders()).filter((o) => inRange(o.createdAt, range));

  return affiliates
    .map((a) => {
      const affiliateOrders = orders.filter((o) => o.affiliateId === a.id);
      return {
        id: a.id,
        name: `${a.firstName} ${a.lastName}`.trim(),
        promoCode: a.promoCode,
        totalSales: affiliateOrders.reduce((sum, o) => sum + o.orderTotal, 0),
        totalCommission: affiliateOrders.reduce((sum, o) => sum + o.commission, 0),
        paidCommission: affiliateOrders
          .filter((o) => o.status === "paid")
          .reduce((sum, o) => sum + o.commission, 0),
        pendingCommission: affiliateOrders
          .filter((o) => o.status === "pending")
          .reduce((sum, o) => sum + o.commission, 0),
        orderCount: affiliateOrders.length,
      };
    })
    .sort((a, b) => b.totalSales - a.totalSales);
}

export async function getTimeSeries(
  range: { start: Date; end: Date; granularity: Granularity },
  affiliateId?: string
): Promise<TimeSeriesPoint[]> {
  const all = (await getAllOrders()).filter((o) => {
    if (affiliateId && o.affiliateId !== affiliateId) return false;
    return true;
  });
  return buildTimeSeries(all, range);
}

export function presetToRange(preset: PresetRange) {
  return presetToRangeImpl(preset);
}

export function resolveRange(value: string | null | undefined) {
  return resolveRangeImpl(value);
}

// ── Password reset tokens ──────────────────────────────────────────────────
// We store only a SHA-256 hash of the token; the raw token lives solely in the
// emailed link. Tokens are single-use and short-lived.

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use password reset token for an email. Any earlier unused
 * tokens for the same email are invalidated. Returns the raw token to embed in
 * the reset link, or null when the database isn't configured.
 */
export async function createAffiliatePasswordReset(
  email: string,
  ttlMinutes = 60
): Promise<{ token: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const normalized = email.toLowerCase().trim();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

  await prisma.affiliatePasswordReset.updateMany({
    where: { email: normalized, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.affiliatePasswordReset.create({
    data: { email: normalized, tokenHash, expiresAt },
  });
  return { token };
}

/**
 * Validate a reset token without consuming it. Returns the row id + email when
 * the token is valid (exists, unused, not expired); null otherwise.
 */
export async function verifyAffiliatePasswordReset(
  token: string
): Promise<{ id: string; email: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const tokenHash = hashResetToken(token.trim());
  const row = await prisma.affiliatePasswordReset.findUnique({
    where: { tokenHash },
  });
  if (!row || row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, email: row.email };
}

/** Mark a reset token as used (after the password has actually been changed). */
export async function markAffiliatePasswordResetUsed(id: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await prisma.affiliatePasswordReset
    .update({ where: { id }, data: { usedAt: new Date() } })
    .catch(() => {});
}

/**
 * Read category-specific commission rates from the DB for one affiliate.
 * Uses raw SQL because the columns may not exist until the migration runs —
 * returns nulls gracefully pre-migration.
 */
export async function getAffiliateCategoryRates(
  affiliateId: string
): Promise<{ supplementsCommissionRate: number | null; skincareCommissionRate: number | null }> {
  try {
    const rows = await prisma.$queryRaw<{ supplements_commission_rate: number | null; skincare_commission_rate: number | null }[]>`
      SELECT supplements_commission_rate, skincare_commission_rate
      FROM supplements_affiliate_profiles
      WHERE id = ${affiliateId}
      LIMIT 1
    `;
    if (!rows.length) return { supplementsCommissionRate: null, skincareCommissionRate: null };
    return {
      supplementsCommissionRate: rows[0].supplements_commission_rate ?? null,
      skincareCommissionRate: rows[0].skincare_commission_rate ?? null,
    };
  } catch {
    // Column doesn't exist yet — pre-migration fallback.
    return { supplementsCommissionRate: null, skincareCommissionRate: null };
  }
}
