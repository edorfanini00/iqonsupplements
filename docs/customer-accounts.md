# IQON Body customer accounts ("My Account")

First-party `/account` area on the IQON Body storefront backed by the **Shopify Customer
Account API** of the existing Headless storefront (public client, OAuth 2.0 authorization
code + PKCE S256). Shopify remains the only customer identity (passwordless email code), the
commerce record and the payment/subscription provider. This site stores no passwords, cards or
customer records. The affiliate portal (`/affiliates`, `/api/affiliates/*`) is untouched and
shares nothing with this code.

## Routes

| Route | Purpose |
|---|---|
| `GET /account/login?return=` | Starts sign-in: encrypted transaction cookie, 303 to Shopify authorize. Prefetches get 204. |
| `GET /account/callback` | Checks state (constant time) against the transaction, exchanges the code with the PKCE verifier, verifies the id_token (RS256 via shop JWKS, issuer, audience, expiry, nonce), creates the session, 303 to an allowlisted path. |
| `POST /account/logout` | Same-origin only. Clears every session chunk, then 303 to Shopify end-session. |
| `/account`, `/account/orders[/id]`, `/account/subscriptions[/id]`, `/account/addresses`, `/account/profile` | Signed-in pages (client components reading `/api/account/*`). |
| `/account/privacy`, `/account/signed-out` | **Public**: no session needed (guest footer access to privacy). |
| `/api/account/*` | JSON BFF. Customer-scoped Customer Account API queries only; no Admin API. |

## Sessions

- Cookies: `__Host-iqb_ca.0..3` (session) and `__Host-iqb_ca_tx` (10 minute login transaction);
  HttpOnly, Secure, SameSite=Lax, Path=/, no Domain. Plain-http `localhost` development drops the
  prefix and Secure.
- Contents are AES-256-GCM sealed with purpose-bound keys (HKDF from
  `CUSTOMER_ACCOUNT_SESSION_SECRET`, purpose also bound as AAD), so a transaction can't be used
  as a session and vice versa. The envelope is split into at most 4 chunks of 3800 bytes; more
  chunks or bytes are rejected before decryption, and a missing, reordered or foreign chunk fails
  GCM authentication. Any invalid envelope clears all chunks. A realistic Shopify session uses
  1–2 chunks. No database, no migration.
- Absolute lifetime 30 days; access tokens refresh 60 s before expiry.
- CSRF: mutations need exact `Origin`, `Sec-Fetch-Site: same-origin` when sent, JSON content type,
  ≤ 8 KB body and `x-iqb-csrf` = HMAC(secret, session id), delivered by `/api/account/session`.
- Responses: `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie`, `X-Robots-Tag: noindex`.

### Refresh concurrency: what is and isn't guaranteed

- Within one server instance, concurrent requests share one refresh (in-memory single-flight,
  retained 30 s so a request carrying the just-rotated cookie reuses the result).
- This is **not** a cross-instance lock. On Vercel two instances can refresh the same session at
  once. If Shopify invalidates a used refresh token, the losing request gets `invalid_grant`.
  Data endpoints then answer 401 **without** touching cookies, so they never overwrite the
  winner's rotated cookie, whatever order the responses arrive in. The client re-checks
  `/api/account/session` with its newest cookie; only that endpoint clears a session that is
  truly dead. Tests: `tests/customer-account/auth.test.ts` ("cross-instance refresh race …").
- Shopify's exact rotation/reuse policy for refresh tokens is not documented and has not been
  observed live yet. Both behaviors (strict rotation, reuse tolerated) are covered by tests
  against the MOCK provider.
- The account client loads the session first and each page makes one data request, so in normal
  use refreshes happen once per tab.

### Logout and the id_token_hint

Shopify's end-session endpoint accepts only `GET` with `id_token_hint` (a POST probe returned
403, a GET with a dummy token 401). So the id_token appears in the Location of the logout
redirect to `shopify.com`, sent with `Referrer-Policy: no-referrer`. This is the only place a
token appears in a URL. It is never logged by this code (`auth.test.ts` asserts it).

## Shopify fields used

Core queries use only fields in Shopify's public Customer Account API reference (checked against
the 2026-10 pages) and are validated against the 2026-04 introspection schema shipped in
`@shopify/hydrogen-react` 2026.4.4 (`tests/customer-account/schema.test.ts`). Contract
eligibility (`appEligibleForCustomerActions`), managing app and the subscription payment method
exist in the schema but not in the public reference. They are fetched by separate optional
queries. If Shopify refuses them, the account still works:
- eligibility becomes "unknown"; status-appropriate actions are offered and Shopify's mutation
  result decides (errors shown verbatim);
- the payment method shows "Managed by Shopify" with the provider page link.

## Subscriptions, payments and addresses

- Native: pause, resume, skip/unskip an upcoming order, cancel (with confirmation). Every action
  re-reads the contract from Shopify and checks the allowed transition before mutating.
- Not native: changing frequency (no documented customer mutation) and changing the card or
  subscription delivery address. These go to Shopify's hosted subscription page when
  `SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED=true`, otherwise "contact us".
- The address book (customer addresses, default selection) is separate from a subscription's own
  delivery address, and the UI says so.
- No card numbers are collected or displayed beyond brand/last 4/expiry from Shopify.

## Tests

```
node --import tsx --test tests/customer-account/*.test.ts      # unit/integration, MOCK provider
npm run build:vercel
PLAYWRIGHT_CORE=<path>/playwright-core node --test --test-concurrency=1 tests/e2e/customer-account.e2e.mjs
```

The browser suite runs the production build. Server-side calls to `https://shopify.com/*` go to
the MOCK provider (`tests/e2e/customer-account-server-hook.mjs`); every other outbound request
is refused. The browser can resolve only `localhost`. Hosted Shopify sign-in/logout are MOCK
routes, reached as fresh navigations after the real `/account/login` 303 has been checked.
**These tests prove IQON Body's side of the flow, not live Shopify behavior.**

## Rollback

Code-only and additive. To disable: unset the four required env vars (the area shows "opening
soon" and the API returns 503 `not_configured`), or revert the PR. Rotating
`CUSTOMER_ACCOUNT_SESSION_SECRET` revokes every session. No migrations.
