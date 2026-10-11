# Storefront privacy choices and checkout consent

## What the storefront does

- The footer shows **Privacy policy** (Shopify hosted policy) and **Your Privacy Choices** on every storefront page.
- Your Privacy Choices records four purposes that match Shopify's `VisitorConsent`: `analytics`, `marketing` (shown as Advertising), `preferences` and `saleOfData`. Each one is granted (`true`), declined (`false`) or not expressed (`null`).
- **Not expressed stays not expressed.** It is never reported as a grant or a denial. Shopify applies the merchant's regional settings to it, which is the intended behavior (owner direction, October 2026).
- **Global Privacy Control** (`navigator.globalPrivacyControl` or the `Sec-GPC: 1` header) overrides advertising and sale or sharing to declined, whatever is stored. Those two controls are locked off while GPC is present.
- No advertising script, pixel, Meta event or Purchase path is added. Shopify's official Meta channel remains the only Purchase owner.

## How a decision is stored

All cookies are httpOnly, SameSite=Lax, Path=/, with no Domain, and expire after 12 months. Production uses the `__Host-` prefix and Secure; local development on `localhost` uses unprefixed names. Page scripts cannot read or write them.

| Cookie | Written by | Holds |
|---|---|---|
| `__Host-iqon_privacy` | every save | the choices, a counter, when they were saved, and the newest decision time the saving request had seen (its *basis*) |
| `__Host-iqon_privacy_w_<purpose>` | every save that declines that purpose | when it was declined |

A declined purpose outranks any grant whose basis is older than the decline. A grant only counts if the request that made it had already seen every withdrawal of that purpose.

This makes the outcome independent of arrival order. Suppose a grant is sent before a withdrawal but its response arrives after it, or two tabs save at once, or an old request is replayed. The grant can overwrite the main cookie. It never overwrites the withdrawal cookie, and its basis predates the withdrawal, so the withdrawal stands.

## Saving, tabs and checkout

- **Saving.** `POST /api/privacy` accepts either:
  - `{withdraw:[purposes]}`, which always applies, or
  - `{choices, expectedVersion}`, where new grants must name the decision version the visitor was shown. Otherwise the request gets a 409, and any withdrawals in it still apply.

  After every save the page reads `GET /api/privacy`, because only a new request carries every cookie the browser holds.
- **Pending withdrawals.** A withdrawal is written at once to shared localStorage (`iqon-privacy-pending:<purpose>`). Every open tab applies it immediately, and every checkout from any tab sends it as a restriction. It stays until a saved decision shows it, or until the visitor grants that purpose again from a form that showed it. Removal is compare and remove, so a newer withdrawal from another tab is never cleared. Any tab retries on load and when the browser comes back online.
- **The open form.** The form keeps the decision version it was filled from. If the decision changes in another tab, the switches reset and the form says so. A save always sends the form's own version.
- **Checkout.** Every checkout runs a new cart read, `IQONCheckoutCart`, with `@inContext(visitorConsent: $visitorConsent)` (Storefront API 2025-10 or later). The page sends the decision version it shows. If that differs from the saved one, the server returns 409 with no link, and the page refreshes and retries. Shopify's `checkoutUrl`, including its `_cs` parameter, is returned unchanged and is never logged or cached. If anything changes while the request is in flight, the link is discarded.

## Threat model and boundary

- Consent lives in the visitor's own browser cookies; there is no server side ledger.
- **Cross-site requests are blocked:** the Origin must match exactly and the content type must be JSON.
- **Sibling subdomains** cannot plant `__Host-` cookies.
- **The visitor's own crafted requests count as the visitor's choice.** A visitor using their own tools can always send a grant, or delete their own cookies. That is the visitor acting, not a third party.
- **Legitimate browser behavior can't undo a withdrawal.** This covers tabs, retries, slow or failed networks, and late responses. The tests cover each case.
- **Replays are inert, not refused.** The server still answers a replayed old request, because it cannot see cookies that request did not carry. The cookies it issues cannot take effect over a newer withdrawal.
- **The Customer Privacy API is not loaded.** Its headless cookie sharing needs checkout on the same root domain as the storefront. Checkout is on `nr9zd0-t5.myshopify.com` and the storefront is on `iqonbody.com`.
- **Shopify's opt out form is a separate record.** An opt out submitted there is not visible to this site.
- **Changes made inside hosted checkout do not come back to the storefront.**
- **Hosted checkout enforcement of `_cs` is not yet verified.** Whether Shopify's hosted web checkout enforces `_cs` (pixels, data sale) has not been checked by a real checkout.

## Tests

- `node --test tests/privacy.test.mjs tests/privacy-hook.test.mjs tests/cart-routes.test.mjs`: consent model, privacy API with per request cookie snapshots and controlled response order, the real `usePrivacy` hook in jsdom, and checkout handoff.
- `npm run build:vercel`, then `PLAYWRIGHT_CORE=<path to playwright-core> node --test --test-concurrency=1 tests/e2e/privacy.e2e.mjs`: the production build in Chromium at 1440×900 and 390×844, against an in process Shopify fixture. Hosted checkout and the opt out page are local stubs.
