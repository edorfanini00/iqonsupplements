// IQON Body — Meta checkout pixel (Shopify custom pixel). GENERATED FILE SOURCE: edit this
// template, then run `node scripts/build-checkout-pixel.mjs`; never edit the generated copies.
//
// Install (parent only, after review): Settings → Customer events → Add custom pixel.
//   Customer privacy → Permission: "Required", Marketing checked.
//   Data sale: "Data collected qualifies as data sale".
// Shopify then loads this code only when its own privacy settings and the visitor's current
// consent (including the storefront's `_cs` handoff, Shopify's hosted opt-out page and GPC)
// allow marketing and sale of data. The checks below repeat that decision at every event.
//
// Sends at most InitiateCheckout and Purchase. No PageView, no automatic events, no customer
// data, no product names or URLs. An order is sent only when EVERY line is an allowlisted
// variant; otherwise nothing is sent for it. The storefront's `_iqon_ad_restriction` cart
// attribute (opt-out or GPC on www.iqonbody.com) blocks sending; it can never grant anything.
const CONFIG = /*__IQON_PIXEL_CONFIG__*/{};

const RESTRICTION_ATTRIBUTE = "_iqon_ad_restriction";
let privacy = typeof init !== "undefined" && init && init.customerPrivacy ? init.customerPrivacy : null;
let revoked = false;
const sent = new Set();

function permitted() {
  return !!privacy && privacy.marketingAllowed === true && privacy.saleOfDataAllowed === true;
}

if (typeof api !== "undefined" && api && api.customerPrivacy && typeof api.customerPrivacy.subscribe === "function") {
  api.customerPrivacy.subscribe("visitorConsentCollected", function (event) {
    privacy = event && event.customerPrivacy ? event.customerPrivacy : null;
    if (!permitted() && typeof window.fbq === "function" && !revoked) {
      revoked = true;
      window.fbq("consent", "revoke");
    } else if (permitted() && revoked && typeof window.fbq === "function") {
      revoked = false;
      window.fbq("consent", "grant");
    }
  });
}

function numericId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const tail = String(value).trim().split("/").pop();
  return /^\d{1,20}$/.test(tail) ? tail : null;
}

function restricted(checkout) {
  const attributes = checkout && Array.isArray(checkout.attributes) ? checkout.attributes : null;
  // An unreadable attribute list cannot show that no restriction exists.
  if (!attributes) return true;
  return attributes.some(function (attribute) {
    return attribute && attribute.key === RESTRICTION_ATTRIBUTE && attribute.value !== "";
  });
}

// Returns the event payload, or null when any line is not an allowlisted variant.
function eligibleContents(checkout) {
  const lines = checkout && Array.isArray(checkout.lineItems) ? checkout.lineItems : [];
  if (!lines.length) return null;
  const contents = [];
  for (const line of lines) {
    const id = numericId(line && line.variant && line.variant.id);
    const quantity = line && line.quantity;
    if (!id || !Object.prototype.hasOwnProperty.call(CONFIG.variants, id)) return null;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return null;
    contents.push({id: id, quantity: quantity});
  }
  return contents;
}

function payloadFor(checkout) {
  const contents = eligibleContents(checkout);
  const money = checkout && checkout.totalPrice;
  const value = money ? Number(money.amount) : NaN;
  const currency = (money && money.currencyCode) || (checkout && checkout.currencyCode);
  if (!contents || !Number.isFinite(value) || value < 0 || !/^[A-Z]{3}$/.test(String(currency))) return null;
  return {
    value: Math.round(value * 100) / 100,
    currency: currency,
    content_type: "product",
    content_ids: contents.map(function (item) { return item.id; }),
    contents: contents,
    num_items: contents.reduce(function (sum, item) { return sum + item.quantity; }, 0),
  };
}

function loadMeta() {
  if (typeof window.fbq === "function") return window.fbq;
  const fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  };
  fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = [];
  // No automatic PageView on history changes and no automatic button/metadata collection.
  fbq.disablePushState = true;
  window.fbq = fbq; window._fbq = window._fbq || fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("set", "autoConfig", false, CONFIG.pixelId);
  fbq("consent", "grant");
  fbq("init", CONFIG.pixelId);
  return fbq;
}

function handle(eventName, checkout, eventId) {
  const decision = {event: eventName, permitted: permitted(), restricted: restricted(checkout), eligible: false};
  const payload = payloadFor(checkout);
  decision.eligible = !!payload;
  if (CONFIG.mode === "diagnostic") {
    console.info("[iqon-meta-checkout diagnostic]", JSON.stringify(decision));
    return;
  }
  if (!decision.permitted || decision.restricted || !payload || !eventId || sent.has(eventId)) return;
  sent.add(eventId);
  loadMeta()("track", eventName, payload, {eventID: eventId});
}

analytics.subscribe("checkout_started", function (event) {
  const checkout = event && event.data && event.data.checkout;
  const token = checkout && typeof checkout.token === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(checkout.token) ? checkout.token : null;
  handle("InitiateCheckout", checkout, token && "ic_" + token);
});

analytics.subscribe("checkout_completed", function (event) {
  const checkout = event && event.data && event.data.checkout;
  const orderId = numericId(checkout && checkout.order && checkout.order.id);
  handle("Purchase", checkout, orderId && "purchase_" + orderId);
});
