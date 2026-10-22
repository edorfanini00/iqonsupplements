// Native pages read Shopify's published policy JSON; no policy prose lives in source.
// Privacy stays on /account/privacy (see lib/hosted-privacy.ts).
const STORE = "https://nr9zd0-t5.myshopify.com/policies";

function policy(label: string, slug: string) {
  return {label, slug, href: `/policies/${slug}`, sourceUrl: `${STORE}/${slug}.json`, fallbackUrl: `${STORE}/${slug}`};
}

export const STORE_POLICIES = {
  shipping: policy("Shipping policy", "shipping-policy"),
  refund: policy("Refund policy", "refund-policy"),
  // Shopify titles the subscription policy page "Cancellation policy".
  subscription: policy("Cancellation policy", "subscription-policy"),
  terms: policy("Terms of service", "terms-of-service"),
  contact: policy("Contact information", "contact-information"),
} as const;

export const STORE_POLICY_LINKS = Object.values(STORE_POLICIES);
export type StorePolicy = (typeof STORE_POLICY_LINKS)[number];
export function findStorePolicy(slug: string) {
  return STORE_POLICY_LINKS.find(policy => policy.slug === slug);
}
