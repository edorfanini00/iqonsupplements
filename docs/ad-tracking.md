# IQON Body advertising measurement (Meta)

Off by default: with no flags set, the site behaves as before. The one exception is that an
opt-out already stored in a browser is still honoured at checkout.

## What sends what

| Event | Sender | Sent only when |
|---|---|---|
| PageView, ViewContent, AddToCart | Storefront (`lib/meta-storefront.ts`, `app/ad-privacy-client.tsx`) | All of these hold:<br>• the visitor chose **Allow** on `/account/privacy` in this browser<br>• no GPC signal and no tab-only opt-out<br>• the route is `/`, `/collections/all`, `/collections/supplements` or a reviewed product page<br>• every item in the bag is a reviewed variant |
| InitiateCheckout, Purchase | Shopify custom pixel (`shopify/custom-pixels/iqon-meta-checkout.live.js`) | All of these hold:<br>• Shopify's current `customerPrivacy` allows both marketing and sale of data<br>• the cart has no `_iqon_ad_restriction` attribute<br>• every line is a reviewed variant |

Reviewed variants are listed in `shopify/custom-pixels/eligibility.json`. Both senders use that one list.

If any item in an order or bag is not reviewed, nothing is sent for it. Items are never stripped out and events are never renamed to get around this.

### How events are sent

- **One request per event.** Each event goes to `https://www.facebook.com/tr` as a single request, and the code sets every parameter.
- **No Meta SDK.** Because the SDK is never loaded, there are:
  - no automatic events
  - no page scraping
  - no `_fbp`/`_fbc` cookies
  - no event queue
- **Page URL and referrer:**
  - `dl` is the page path only, with no query string or fragment.
  - The checkout pixel always uses a fixed neutral URL.
  - Requests use `referrerPolicy: no-referrer`.
- **Event IDs:**
  - InitiateCheckout: `ic_` followed by the SHA-256 of the checkout token. The raw token is never sent.
  - Purchase: `purchase_<order id>`.
- **Dedupe:** a Purchase is claimed in Shopify's pixel `browser.localStorage`, which backs up Shopify's documented once-per-checkout event.
- **Withdrawal:** an event decided before a withdrawal is never sent after it.

### What is not here

- No server-side Conversions API (CAPI).
- No Shopify Data sharing (it must stay **OFF**).
- No Purchase webhook.

## Visitor choices

The choice is stored in the cookie `iqon_ad_choice`. Only the browser writes it, at the moment of the click; no server response ever writes it.

- **Stale panels:** a panel that was showing an older choice cannot apply a click.
- **Opt-out:**
  - It writes `_iqon_ad_restriction` to the cart. That attribute is never removed from that cart.
  - It is passed to checkout as `@inContext(visitorConsent: {marketing:false, saleOfData:false})`.
- **GPC:** it does the same as an opt-out, and it overrides a stored Allow.
- **Allow:** passed to checkout as `{marketing:true, saleOfData:true}`.
- **No choice:** checkout is unchanged, and Shopify's regional defaults apply.

## Configuration

| Variable | Effect |
|---|---|
| `AD_PRIVACY_CONTROLS=on` | Shows the Allow/Opt out control and the footer link "Your Privacy Choices", and turns on the checkout handoff. |
| `META_STOREFRONT_EVENTS=on` | Turns on storefront events. Requires `AD_PRIVACY_CONTROLS=on`. |

There are no secrets. The pixel ID is public and is stored in `eligibility.json`.

## Checkout pixel install (parent only, after reviews)

1. Run `node scripts/build-checkout-pixel.mjs --check`.
2. In Shopify, add a custom pixel under Customer events. Set **Permission** to *Required: Marketing* and **Data sale** to *qualifies as data sale*.
3. Paste the **diagnostic** file first. It never contacts Meta.
4. Qualify it (see below), then replace it with the live file.
5. Rollback: Disconnect the pixel, and unset the flags.

## Tests

```
node scripts/build-checkout-pixel.mjs --check
node --import tsx --test tests/tracking/*.test.mjs tests/cart-routes.test.mjs
npm run build:vercel && node --test tests/hosted-privacy-release.test.mjs
PLAYWRIGHT_CORE=<path>/playwright-core node --test --test-concurrency=1 tests/e2e/ad-privacy.e2e.mjs
```

The browser suite mocks the following, so it proves IQON's side of the flow, not Shopify's or Meta's behaviour:

- the Storefront API
- a synthetic `_cs` value
- the hosted checkout, which runs the generated pixel
- Meta's endpoint

## Not proven here (provider qualification)

- **Checkout permission:** whether Shopify sets `init.customerPrivacy` from `_cs`, the hosted opt-out page and GPC.
- **Restriction attribute:** whether `checkout.attributes` exposes `_iqon_ad_restriction`, and whether a later cart update reaches a checkout that is already open.
- **Sandbox APIs:** whether `crypto.subtle`, `fetch` with `no-referrer`, and `browser.localStorage` behave as expected inside the pixel sandbox.
- **Meta:** whether the image endpoint accepts `eid`, and how Meta deduplicates and attributes these events.
- **Purchase end to end:** this needs an authorized order route. A Test Events receipt or a `_cs` URL is not proof.
