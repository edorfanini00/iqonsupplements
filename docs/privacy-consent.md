# Storefront privacy choices and checkout consent

## What the storefront does

- The footer shows **Privacy policy** (Shopify hosted policy) and **Your Privacy Choices** on every storefront page.
- Your Privacy Choices records four purposes that match Shopify's `VisitorConsent`: `analytics`, `marketing` (shown as Advertising), `preferences` and `saleOfData`. Each one is granted (`true`), declined (`false`) or not chosen (`null`). **Not chosen is never treated as granted.**
- Choices are saved by `POST /api/privacy` into a `__Host-iqon_privacy` cookie (httpOnly, Secure, SameSite=Lax, Path=/, no Domain, 12 months). Only local development on `localhost` uses the unprefixed `iqon_privacy` name. Page scripts cannot read or write it.
- **Global Privacy Control** (`navigator.globalPrivacyControl` or the `Sec-GPC: 1` header) overrides advertising and sale or sharing to declined, whatever is stored. Those two controls are locked off while GPC is present.
- **Withdrawals always apply.** A new grant must be made against the latest saved revision, so an outdated tab cannot bring back a withdrawn grant (HTTP 409). Withdrawals in the same request still apply. If saving a withdrawal fails, the page keeps it, sends it with checkout, and saves it again on the next load.
- No advertising script, pixel, Meta event or Purchase path is added. `advertisingAllowed()` in `lib/privacy.ts` is the gate that any future storefront advertising must check.

## Checkout handoff

Every checkout runs a new cart read, `IQONCheckoutCart`, with `@inContext(visitorConsent: $visitorConsent)` (Storefront API 2025-10 or later; older configured versions are raised to 2025-10 for this one query). Shopify returns a `checkoutUrl` with a `_cs` parameter that encodes the consent. The server returns it unchanged and never logs it, and the page never caches it. If privacy choices change while the request is in flight, the page throws that link away and asks for a new one.

Choices not made are left out of `VisitorConsent`, which Shopify documents as "no preference expressed". Shopify then applies its own regional rules for that visitor at checkout.

## Boundary: what this does not do

- **The Customer Privacy API is not loaded.** Its headless cookie sharing needs checkout on the same root domain as the storefront. Checkout is on `nr9zd0-t5.myshopify.com` and the storefront on `iqonbody.com`, so that route would not work here and is not claimed.
- **Shopify's opt out form is a separate record.** The panel links to it, but an opt out submitted there is not visible to this site and does not change the choices saved here. The panel says so.
- **Changes made inside hosted checkout do not come back to the storefront.** Those are handled by Shopify on its own domain.
- Whether Shopify's hosted web checkout honors `_cs` in every respect has only been checked by the read only probe described in the PR, not by a completed checkout.

## Tests

- `node --test tests/privacy.test.mjs tests/cart-routes.test.mjs`: consent model, privacy API, checkout handoff.
- `npm run build:vercel` then `PLAYWRIGHT_CORE=<path to playwright-core> node --test --test-concurrency=1 tests/e2e/privacy.e2e.mjs`: the production build in Chromium at 1440×900 and 390×844, against an in process Shopify fixture. Hosted checkout and the opt out page are local stubs.
