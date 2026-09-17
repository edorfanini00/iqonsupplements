/**
 * Customer directory, aggregated from paid Shopify orders.
 *
 * There is no standalone "customers" table for guest buyers, so the canonical
 * list of people we've done business with is derived from paid orders (billing
 * name + email), deduped by email. Used by the admin Customers tab to pick
 * recipients for outbound emails.
 *
 * Server-only.
 */

import { listPaidOrders } from "@/lib/portal-commerce";

export interface CustomerSummary {
  email: string;
  name: string;
  firstName: string;
  orderCount: number;
  totalSpent: number;
  currency: string;
  /** ISO date of the most recent order. */
  lastOrderDate: string;
}

/**
 * Build the deduped customer list from all paid orders. Returns `truncated`
 * true when Shopify pagination hit its safety cap before exhausting orders.
 */
export async function listCustomers(): Promise<{
  customers: CustomerSummary[];
  truncated: boolean;
}> {
  const { orders, truncated } = await listPaidOrders();

  const byEmail = new Map<string, CustomerSummary>();
  for (const o of orders) {
    const email = (o.billing?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) continue;

    const firstName = (o.billing?.first_name ?? "").trim();
    const lastName = (o.billing?.last_name ?? "").trim();
    const name = `${firstName} ${lastName}`.trim();
    const date = o.date_paid || o.date_created || "";
    const total = Number.parseFloat(o.total ?? "0") || 0;

    const existing = byEmail.get(email);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpent += total;
      if (date && date > existing.lastOrderDate) existing.lastOrderDate = date;
      if (!existing.name && name) {
        existing.name = name;
        existing.firstName = firstName;
      }
    } else {
      byEmail.set(email, {
        email,
        name: name || email,
        firstName,
        orderCount: 1,
        totalSpent: total,
        currency: o.currency ?? "USD",
        lastOrderDate: date,
      });
    }
  }

  const customers = [...byEmail.values()].sort((a, b) =>
    b.lastOrderDate.localeCompare(a.lastOrderDate)
  );

  return { customers, truncated };
}
