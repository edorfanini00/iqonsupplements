/* Shopify Customer Events custom pixel, IQON Body only.
 * Admin privacy: Permission REQUIRED: Marketing; Data sale: qualifies as data sale.
 * Keep disconnected until Shopify consent and health eligibility are independently reviewed.
 * No approved variants yet: no SDK request, no Purchase. Do not add IDs merely
 * because Meta's displayed category is None. No data restriction bypass.
 * Privacy API: https://shopify.dev/docs/api/web-pixels-api/pixel-privacy
 */
const PIXEL_ID = "1006368245818889";
const APPROVED_VARIANTS = new Set([]);
let privacy = init.customerPrivacy;
const allowed = () => privacy?.marketingAllowed === true && privacy?.saleOfDataAllowed === true
  && navigator.globalPrivacyControl !== true;
api.customerPrivacy.subscribe("visitorConsentCollected", (event) => {
  privacy = event.customerPrivacy;
  if (!allowed()) window.fbq?.("consent", "revoke");
});
const tail = value => String(value ?? "").split("/").pop();
analytics.subscribe("checkout_completed", (event) => {
  if (!allowed()) return;
  const checkout = event.data.checkout;
  const orderId = tail(checkout.order?.id);
  const lines = checkout.lineItems ?? [];
  if (!/^\d{1,20}$/.test(orderId) || !lines.length
    || !lines.every(line => APPROVED_VARIANTS.has(tail(line.variant?.id)))) return;
  // SDK activation remains blocked pending sandbox URL minimization and consent
  // transfer verification. Do not inject fbevents.js here until that review passes.
  void PIXEL_ID;
});
