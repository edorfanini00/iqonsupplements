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
| `POST /account/logout` | Same-origin only. Revokes the session row (no cookie change), then 303 to Shopify end-session. |
| `/account`, `/account/orders[/id]`, `/account/subscriptions[/id]`, `/account/addresses`, `/account/profile` | Signed-in pages (client components reading `/api/account/*`). |
| `/account/privacy`, `/account/signed-out` | **Public**: no session needed. `/account/privacy` links to Shopify's hosted **Your Privacy Choices** (data sharing opt-out) and **Privacy policy** pages for the IQON store (`lib/hosted-privacy.ts`). It is in the account menu and the storefront footer ("Privacy"). This site keeps no consent state and loads no advertising or analytics scripts. |
| `/api/account/*` | JSON BFF. Customer-scoped Customer Account API queries only; no Admin API. |

## Sessions (round 1 design: durable, server-side)

- **Cookie**: `__Host-iqb_ca` = `id.secret` (24 + 32 random bytes, base64url). HttpOnly, Secure,
  SameSite=Lax, Path=/, 30 days. It is an opaque pointer: no tokens, no customer data.
- **Session of record**: one row in `customer_account_sessions` (existing PostgreSQL,
  `SUPPLEMENTS_DATABASE_URL`; migration `20261011010000_customer_account_sessions`, additive).
  `tokens` is AES-256-GCM sealed with a purpose-bound key and the row id as additional data
  (a sealed value only opens on its own row). `secret_hash` is an HMAC of the cookie secret,
  compared in constant time. No plaintext provider credential is stored or logged.
- **Who writes the cookie**: only a successful `/account/callback`. Data endpoints,
  `/api/account/session` and `/account/logout` never set or clear it. Consequences, each covered by
  `tests/customer-account/races.test.ts` and the two-tab browser test:
  - a late successful refresh can't restore a signed-out session, and the refreshed tokens are
    discarded if the row was revoked meanwhile;
  - a late response for A can't replace B's newer sign-in;
  - a stale authentication failure or malformed cookie can't erase a newer session;
  - a delayed logout response can't sign a newer session out.
- **Logout** revokes the row (`revoked_at`), then redirects to Shopify end-session. The browser
  keeps a dead pointer until the next sign-in overwrites it.
- **Refresh, across instances**:
  - Coordinated through the row. A request needing a refresh takes a lease with one conditional
    `UPDATE` (live row, same `generation`, no unexpired lease), then calls Shopify with a 10 s timeout.
  - It installs the new tokens with a compare-and-set on `(generation, lease owner, not revoked)`,
    incrementing `generation`.
  - Other requests poll the row (bounded, 12 s) and use the new generation.
  - A crashed holder's lease lapses after 20 s. A rejected grant revokes exactly that generation.
  - Proven with two separate Node processes against one PostgreSQL and a strictly rotating mock
    (`tests/customer-account/two-process.test.ts`): one refresh, both requests signed in.
- **Outages**: database unavailable → 503 "unavailable", never "signed out"; the cookie is untouched.
- **Retention**: each sign-in purges up to 25 rows that expired or were revoked over 7 days ago.
- CSRF: mutations need exact `Origin`, `Sec-Fetch-Site: same-origin` when sent, JSON, ≤ 8 KB and
  `x-iqb-csrf` = HMAC(secret, session id) from `/api/account/session`.

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
- Order summaries fetch the first four lines for thumbnails; when an order has more lines the count
  is shown as "N+ items" (`pageInfo.hasNextPage`), never as an exact total. Detail pages show all lines.
- Not native: changing frequency (no documented customer mutation) and changing the card or
  subscription delivery address. These go to Shopify's hosted subscription page when
  `SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED=true`, otherwise "contact us".
- The address book (customer addresses, default selection) is separate from a subscription's own
  delivery address, and the UI says so.
- No card numbers are collected or displayed beyond brand/last 4/expiry from Shopify.

## Tests

```
scripts/account-test-db.sh node --import tsx --test tests/customer-account/*.test.ts   # owned loopback PostgreSQL + MOCK provider
npm run build:vercel
E2E_PORT=3919 PLAYWRIGHT_CORE=<path>/playwright-core scripts/account-test-db.sh node --test --test-concurrency=1 tests/e2e/customer-account.e2e.mjs
```

The browser suite runs the production build. Server-side calls to `https://shopify.com/*` go to
the MOCK provider (`tests/e2e/customer-account-server-hook.mjs`); every other outbound request
is refused. The browser can resolve only `localhost`. Hosted Shopify sign-in/logout are MOCK
routes, reached as fresh navigations after the real `/account/login` 303 has been checked.
**These tests prove IQON Body's side of the flow, not live Shopify behavior.**

## Rollback

Additive. Requires migration `prisma/migrations/20261011010000_customer_account_sessions` applied to
the existing database **before** the code is deployed; without the table, sign-in returns
"unavailable" and nothing else on the storefront changes.
- **Preferred rollback: code only.** Revert or redeploy the previous build and leave the additive
  table in place (unused, harmless).
- Disable without a deploy: unset the four required env vars ("opening soon", API 503 `not_configured`).
- Revoke every session: `UPDATE customer_account_sessions SET revoked_at = now() WHERE revoked_at IS NULL;`
  (rotating `CUSTOMER_ACCOUNT_SESSION_SECRET` also makes every row unreadable).
- Only if the table must go, after the code is reverted: `DROP TABLE "customer_account_sessions";`
