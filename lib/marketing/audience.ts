/**
 * Email-marketing audience: people who created an account (Shopify
 * registered customers) but have never placed a paid order.
 *
 * Built live from Shopify: all registered customers minus everyone whose
 * email appears on a paid (processing/completed) order, minus affiliates.
 * Server-only.
 */

import { listPaidOrders, registeredCustomers } from "@/lib/portal-commerce";
import { getAllAffiliates } from "@/lib/affiliates/store";

export interface SignupProspect {
  email: string;
  name: string;
  firstName: string;
  /** ISO date the account was created. */
  signedUpAt: string;
}

interface ShopifyCustomerRow {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  date_created?: string;
}

export const fetchRegisteredCustomers=registeredCustomers;

/**
 * Signed-up-but-never-ordered prospects, newest signup first. `truncated` is
 * true when either the customer or order scan hit its pagination safety cap.
 */
export async function listSignupProspects(): Promise<{
  prospects: SignupProspect[];
  truncated: boolean;
}> {
  const [customersResult, ordersResult, affiliates] = await Promise.all([
    fetchRegisteredCustomers(),
    listPaidOrders(),
    getAllAffiliates().catch(() => []),
  ]);

  const orderedEmails = new Set<string>();
  for (const o of ordersResult.orders) {
    const email = (o.billing?.email ?? "").trim().toLowerCase();
    if (email) orderedEmails.add(email);
  }

  const excludedEmails = new Set<string>();
  for (const a of affiliates) {
    const email = (a.email ?? "").trim().toLowerCase();
    if (email) excludedEmails.add(email);
  }

  const seen = new Set<string>();
  const prospects: SignupProspect[] = [];
  for (const c of customersResult.customers) {
    const email = (c.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    if (orderedEmails.has(email) || excludedEmails.has(email)) continue;
    seen.add(email);

    const firstName = (c.first_name ?? "").trim();
    const name = `${firstName} ${(c.last_name ?? "").trim()}`.trim();
    prospects.push({
      email,
      name: name || email,
      firstName,
      signedUpAt: c.date_created ?? "",
    });
  }

  return {
    prospects,
    truncated: customersResult.truncated || ordersResult.truncated,
  };
}
