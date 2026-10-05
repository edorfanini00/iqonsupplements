/**
 * Optional Admin API read used when a webhook payload is missing something the
 * email needs: the recipient for a shipping email when neither the fulfilment
 * nor our stored snapshot has one, line item quantities for partial shipment
 * detection, and subscription (selling plan) names, which Shopify's REST
 * order webhook does not reliably include. Read only; reuses the existing
 * supplements Admin client and is skipped entirely when it is not configured.
 */
import { shopifyAdmin, shopifyAdminConfigured } from "../../affiliates/shopify-admin";
import type { EmailAddress } from "../emails/types";
import { safeHttpsUrl } from "../emails/format";

export interface AdminOrderInfo {
  name: string | null;
  email: string | null;
  firstName: string | null;
  shippingAddress: EmailAddress | null;
  orderStatusUrl: string | null;
  lineItems: { id: string; quantity: number; requiresShipping: boolean; sellingPlanName: string | null }[];
}

export type AdminOrderLookup = (orderId: string) => Promise<AdminOrderInfo | null>;

export const ADMIN_ORDER_QUERY = `query OrderEmailDetails($id:ID!){order(id:$id){
  name email statusPageUrl
  shippingAddress{firstName lastName company address1 address2 city provinceCode zip country}
  lineItems(first:100){nodes{id currentQuantity requiresShipping sellingPlan{name}}}
}}`;

type AdminOrder = {
  name?: string | null;
  email?: string | null;
  statusPageUrl?: string | null;
  shippingAddress?: { firstName?: string | null; lastName?: string | null; company?: string | null; address1?: string | null; address2?: string | null; city?: string | null; provinceCode?: string | null; zip?: string | null; country?: string | null } | null;
  lineItems?: { nodes?: { id?: string; currentQuantity?: number; requiresShipping?: boolean; sellingPlan?: { name?: string | null } | null }[] } | null;
} | null;

export function mapAdminOrder(order: AdminOrder): AdminOrderInfo | null {
  if (!order) return null;
  const a = order.shippingAddress;
  const name = [a?.firstName, a?.lastName].filter(Boolean).join(" ") || null;
  return {
    name: order.name ?? null,
    email: order.email && order.email.includes("@") ? order.email : null,
    firstName: a?.firstName ?? null,
    shippingAddress: a && (a.address1 || a.city)
      ? { name, company: a.company ?? null, address1: a.address1 ?? null, address2: a.address2 ?? null, city: a.city ?? null, province: a.provinceCode ?? null, zip: a.zip ?? null, country: a.country ?? null }
      : null,
    orderStatusUrl: safeHttpsUrl(order.statusPageUrl),
    lineItems: (order.lineItems?.nodes ?? []).flatMap((line) => {
      const id = line.id?.split("/").pop();
      if (!id || !/^\d+$/.test(id) || !Number.isInteger(line.currentQuantity)) return [];
      return [{ id, quantity: line.currentQuantity!, requiresShipping: line.requiresShipping !== false, sellingPlanName: line.sellingPlan?.name ?? null }];
    }),
  };
}

export function adminOrderLookup(): AdminOrderLookup | null {
  if (!shopifyAdminConfigured()) return null;
  return async (orderId) => {
    const data = await shopifyAdmin<{ order: AdminOrder }>(ADMIN_ORDER_QUERY, { id: `gid://shopify/Order/${orderId}` });
    return mapAdminOrder(data.order);
  };
}
