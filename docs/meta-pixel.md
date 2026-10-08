# Meta Pixel and Conversions API (www.iqonbody.com)

Dataset / pixel: **IQON Body Web**, id `1006368245818889` (IQON portfolio, connected to ad account `act_1600704801853649`).

## What fires where

| Event | Browser (fbq) | Server (Conversions API) | event_id |
| --- | --- | --- | --- |
| PageView | every storefront route change, `app/meta-pixel.tsx` | `/api/meta/track` relay | random UUID per event |
| ViewContent | product pages, `app/meta-view-content.tsx` | relay | random UUID |
| AddToCart | after `/api/cart` add succeeds, `app/store-shell.tsx` | relay | random UUID |
| InitiateCheckout | right before the redirect to Shopify checkout, `app/store-shell.tsx` | relay (fetch `keepalive`, survives the redirect) | random UUID |
| Purchase | Shopify Customer Events custom pixel (below; installed by the owner in Shopify admin) | Shopify `orders/paid` webhook to `/api/webhooks/shopify/meta-purchase` | `purchase_<Shopify order id>` on both |

Browser and server copies carry the same `event_id`, so Meta keeps one. The affiliate portal (`/affiliates/*`) sends no events.

* `content_ids`: the numeric Shopify **variant** id (`gid://shopify/ProductVariant/8001` becomes `8001`), `content_type: product`, on every event including Purchase, so reporting and any later catalog match. ViewContent uses the variant the product page opens with (first available). In the unconnected design preview there are no variants, so the product handle is used.
* `value` / `currency`: ViewContent the variant price; AddToCart unit price (subscription plan price when a plan was chosen) times quantity; InitiateCheckout the bag subtotal; Purchase the order total (`current_total_price`: after discounts, with shipping and tax), shop currency (USD).
* Dedupe guards (`lib/analytics/meta.ts`): the same PageView/ViewContent key inside 700 ms (React Strict Mode, hydration), AddToCart inside 400 ms, InitiateCheckout inside 1.5 s (double click) is dropped. Purchase is deterministic per order, so webhook retries and the browser copy collapse in Meta.

## Code

```
lib/analytics/meta-shared.ts    pixel id, domain verification value, relay allowlist, cart attribute keys and validation (browser + server)
lib/analytics/meta.ts           browser: fbq stub/init, event_id, dedupe, track helpers, relay POST
lib/analytics/meta-capi.ts      server only: normalise + SHA-256 PII, POST to Graph API, 3.5 s timeout, never throws, logs once if no token
lib/analytics/meta-relay.ts     server only: /api/meta/track logic (allowlist, origin check, 4 KB cap, sanitised custom_data, reads _fbp/_fbc/IP/UA)
lib/analytics/meta-purchase.ts  server only: orders/paid HMAC check, order -> Purchase mapping, skip rules
app/meta-pixel.tsx              loads fbevents.js (next/script, afterInteractive) and fires PageView
app/meta-view-content.tsx       ViewContent on product pages
app/api/meta/track/route.ts     relay (GET = diagnostic: tokenSet, pixelId; never shows the token)
app/api/webhooks/shopify/meta-purchase/route.ts  Purchase webhook
app/layout.tsx                  <meta name="facebook-domain-verification" content="0lu4a3qv07rw7jbt484id6y35f7pwf"> in <head> of every page
lib/shopify.server.ts           writes _fbp, _fbc, _event_source_url as cart attributes (cart create + checkout handoff)
```

The relay accepts only `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout` (anything else: 204, nothing sent). It takes no PII from the browser; match signals come from the request (cookies `_fbp`/`_fbc`, `x-forwarded-for`, `user-agent`). The token is sent in the POST body, never in a URL or log.

## Purchase: why a webhook

Checkout and the thank you page run on Shopify's hosted checkout (`nr9zd0-t5.myshopify.com`), which this site cannot see. Two copies, same `event_id`:

1. **Server (this repo):** Shopify `orders/paid` webhook to `https://www.iqonbody.com/api/webhooks/shopify/meta-purchase`. It verifies the shop domain and the HMAC (`SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET`, same key and helper as the order email webhook), maps the order and sends Purchase with hashed email, phone, name, city, state, zip, country and customer id, plus raw `browser_ip`, `client_details.user_agent` and the `_fbp`/`_fbc` that the storefront put on the cart.
2. **Browser (Shopify admin):** a Customer Events custom pixel on `checkout_completed` (snippet below).

**fbp/fbc across domains.** `_fbp`/`_fbc` live on `iqonbody.com` and cannot be read on `*.myshopify.com`. The storefront therefore writes them, plus the page the buyer checked out from, as hidden cart attributes (`_fbp`, `_fbc`, `_event_source_url`; the leading underscore hides them in checkout). They are set in `cartCreate` and refreshed right before the checkout redirect (`cartAttributesUpdate`, only when something changed, bounded to 2.5 s, failures ignored so checkout is never blocked). Other attributes on the cart are preserved. Shopify copies cart attributes to the order's `note_attributes`, which the webhook reads.

**Skip rules.** Test orders are skipped unless `META_CAPI_TEST_EVENT_CODE` is set (then they go to Events Manager > Test events). Subscription renewals (Shopify Subscriptions billing, `source_name` `subscription_contract*`, same rule as the order emails) are skipped: they are not a website conversion.

**No email.** This is a separate route from `/api/webhooks/shopify/orders` (which sends the Resend order emails and whose `orders/paid` subscription was deleted when Shopify became the single email sender). The Meta route imports no sender, ledger or database code (enforced by a test). Do **not** point the Meta webhook at `/api/webhooks/shopify/orders`, and do not recreate the old email webhook.

**Responses.** 200 sent / skipped / unsupported topic / Meta 4xx (retry cannot fix it); 401 wrong shop or bad signature; 400 bad JSON; 503 secret missing or Meta unreachable/5xx/429 (Shopify retries; Meta dedupes on `event_id`).

## Environment variables

| Name | Where | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_META_PIXEL_ID` | Vercel, all environments | No | Default `1006368245818889`. Set to `off` on Preview to keep preview traffic out of the dataset. Build time value (redeploy after changing). |
| `META_CAPI_ACCESS_TOKEN` | Vercel Production, **server only** (never `NEXT_PUBLIC_`) | For server events | Without it every server send is a no-op and one warning is logged. |
| `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` | Vercel Production | For the Purchase webhook | Existing variable used by the order email webhook. Admin created webhooks: the signing key shown in Settings > Notifications > Webhooks. App created: the app client secret. |
| `META_CAPI_TEST_EVENT_CODE` | Vercel | No | Only while testing in Events Manager > Test events; remove afterwards. |
| `META_GRAPH_VERSION` | Vercel | No | Default `v24.0`. |

**Token:** Events Manager > Data sources > **IQON Body Web** > **Settings** > **Conversions API** > **Generate access token**. Paste it only into Vercel (Production, server side, `META_CAPI_ACCESS_TOKEN`), then redeploy. Check: `curl -s https://www.iqonbody.com/api/meta/track` returns `"tokenSet":true`.

## Go live (owner, in this order)

1. Merge and deploy. The pixel and the domain tag go live with the deploy; server events stay off until the token exists.
2. Meta Business Settings > Brand safety > Domains > `iqonbody.com` > meta tag method > **Verify**.
3. Generate the CAPI token (above), set `META_CAPI_ACCESS_TOKEN` in Vercel Production, redeploy, check `tokenSet:true`.
4. Make sure `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` is set (see table), then create the webhook: Shopify admin > Settings > Notifications > Webhooks > **Create webhook**: Event **Order payment**, Format **JSON**, URL `https://www.iqonbody.com/api/webhooks/shopify/meta-purchase`, the newest stable API version. Only this one event. No other webhook changes.
5. Shopify admin > Settings > Customer events > **Add custom pixel** named `Meta Pixel Purchase (IQON Body)`, paste the snippet below, Customer privacy: Permission **Required** (Marketing), Data sale **Data collected qualifies as data sale**, Save, **Connect**.
6. Test: set `META_CAPI_TEST_EVENT_CODE` from Events Manager > Test events, redeploy, browse home > product > add to bag > checkout and place a real low value order (or a Shopify test order; with the test code set it is sent too). Expect PageView, ViewContent, AddToCart, InitiateCheckout as Browser and Server, deduplicated, and Purchase (`purchase_<order id>`) from Server and Browser, deduplicated. Then remove `META_CAPI_TEST_EVENT_CODE` and redeploy.
7. Check Events Manager > IQON Body Web > Settings for a Health and Wellness data restriction (see research/TRACKING_GAP.md).

### Customer Events custom pixel (browser Purchase)

```js
// IQON Body: Meta Pixel browser Purchase on Shopify checkout.
// eventID purchase_<order id> matches the server Purchase from
// www.iqonbody.com/api/webhooks/shopify/meta-purchase, so Meta keeps one.
const PIXEL_ID = "1006368245818889";
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');

const tail = (id) => String(id ?? "").split("/").pop();

analytics.subscribe("checkout_completed", (event) => {
  const checkout = event.data.checkout;
  const orderId = tail(checkout.order && checkout.order.id);
  if (!orderId) return;
  const lines = (checkout.lineItems || []).filter((l) => l.variant && l.variant.id);
  const match = {};
  if (checkout.email) match.em = checkout.email.trim().toLowerCase();
  if (checkout.phone) match.ph = checkout.phone.replace(/\D/g, "");
  fbq("init", PIXEL_ID, match);
  fbq("track", "Purchase", {
    value: Number((checkout.totalPrice && checkout.totalPrice.amount) || 0),
    currency: checkout.currencyCode || "USD",
    content_type: "product",
    content_ids: [...new Set(lines.map((l) => tail(l.variant.id)))],
    contents: lines.map((l) => ({ id: tail(l.variant.id), quantity: l.quantity, item_price: Number((l.variant.price && l.variant.price.amount) || 0) })),
    num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
    order_id: orderId,
  }, { eventID: "purchase_" + orderId });
});
```

It subscribes to `checkout_completed` only (the storefront already sends InitiateCheckout). fbevents.js hashes `em`/`ph` itself.

## Consent

The storefront has no cookie or consent banner today, so the pixel loads for everyone (same as before for Shopify's own pixels). If a banner is added, gate `MetaPixel` on it and call `fbq("consent", "revoke" | "grant")`. The Customer Events pixel follows Shopify's customer privacy settings.

## Rollback

* Pixel off without a code change: set `NEXT_PUBLIC_META_PIXEL_ID=off` and redeploy (browser events and relay stop; the domain tag stays).
* Server events off: remove `META_CAPI_ACCESS_TOKEN` and redeploy (relay and webhook return skipped).
* Purchase: delete the "Order payment" webhook to `/meta-purchase` in Settings > Notifications > Webhooks, and disconnect the custom pixel in Settings > Customer events.
* Code: revert the merge commit. Nothing stored, no migrations. Cart attributes already on carts are harmless.

## Tests

```
npm run test:meta            # tests/meta/meta.test.ts
npm run typecheck:next
npx eslint lib/analytics app/meta-pixel.tsx app/meta-view-content.tsx app/api/meta app/api/webhooks/shopify/meta-purchase tests/meta
npm run build:vercel
```
