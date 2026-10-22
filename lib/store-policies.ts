// Shopify-hosted store policies for the IQON store (verified 2026-10-22: HTTP 200, no redirect, each titled
// "<label> – IQON"). Shopify is the source of truth: link to these pages rather than copying their text, and
// do not add same-host /policies routes. Privacy stays on /account/privacy (see lib/hosted-privacy.ts).
const STORE = "https://nr9zd0-t5.myshopify.com/policies";

export const STORE_POLICIES = {
  shipping: {label: "Shipping policy", href: `${STORE}/shipping-policy`},
  refund: {label: "Refund policy", href: `${STORE}/refund-policy`},
  // Shopify titles the subscription policy page "Cancellation policy".
  subscription: {label: "Cancellation policy", href: `${STORE}/subscription-policy`},
  terms: {label: "Terms of service", href: `${STORE}/terms-of-service`},
  contact: {label: "Contact information", href: `${STORE}/contact-information`},
} as const;

export const STORE_POLICY_LINKS = Object.values(STORE_POLICIES);
