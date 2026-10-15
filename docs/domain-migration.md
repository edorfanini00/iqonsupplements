# IQON Daily domain migration

Target storefront: `https://www.iqondaily.com`. This branch prepares code; it does **not** prove a production cutover. Do not merge/deploy or redirect `iqonbody.com` until the exact-head reviews and external gates below pass. No TikTok operation is included.

## Acceptance and boundaries

- Daily is the public link/asset default and homepage canonical, with clearly branded customer account/affiliate copy. Existing noindex policy is retained. Additional page-specific SEO canonicals are outside this focused migration; the homepage canonical is not inherited by other routes.
- Shopify remains the authority for customers, orders, subscriptions and hosted checkout. IQON Health remains the affiliate identity/financial authority. Its branding, research restrictions, sender/support addresses, API credentials, provider IDs, `body` integration paths and cookie names are preserved.
- Explicit `CUSTOMER_ACCOUNT_PUBLIC_ORIGIN`, `SHARED_AFFILIATE_PORTAL_ORIGIN` and email asset overrides take precedence. The public-brand constant never authorizes an origin.
- Existing order-status URLs are opaque provider values: preserve host, path and query, even when they reference the old domain. Do not replace them with a Shopify domain by guesswork.
- No database migration, domain deletion, real customer email, test purchase, subscription mutation or notification is required by this code change.

## Inventory

| Surface | Code treatment | External dependency |
| --- | --- | --- |
| Public identity | `lib/storefront.ts`, root metadata and homepage-only canonical use Daily | Vercel verified domains and TLS |
| Account presentation | Account title and OAuth client label say Daily | No provider identity change |
| Customer auth | Explicit env origin still controls callback/logout and secure host-only cookies | Shopify Headless allowed JS origins, callbacks, logout URLs; Vercel origin |
| Affiliate partner links/copy | Daily supplement partner; Health unchanged | Health backend's approved portal origin and its generated invitation/reset/cross-store links |
| Email assets/footer | Daily default; optional explicit asset origin preserved | Vercel email env, Resend templates/link settings, sender verification |
| Provider order links | Kept unchanged in templates, fixtures and rendered preview examples | Legacy order deep-link routing must be proven independently |
| Checkout | No URL rewrite; existing Shopify-issued checkout URL retained | Storefront channel checkout/account return links and Shopify domain settings |
| Webhooks | No endpoint or subscription mutation | Existing subscriptions, HMAC configuration, delivery history and retry behavior |
| Historical references | Existing migration/schema comments, opaque synthetic order links and sender-domain error fixtures retained | These are not migration targets |

Search with `rg -n -i 'iqonbody|iqon body' --glob '!package-lock.json'` to reproduce the inventory. The preview generator deliberately retains a synthetic legacy order link while generating new Daily asset/footer links; this exercises mixed-era transactional mail.

## Observed pre-cutover state (2026-10-15)

Read-only inspection found Daily apex and www attached to Vercel and serving HTTPS. The www Daily login still selects `https://www.iqonbody.com/account/callback`. Its transaction cookie is host-only on Daily, so that cross-host callback is **not a working OAuth migration**. `SHARED_AFFILIATE_PORTAL_ORIGIN` still identifies the old www host (shared production/preview scope). The sensitive customer-account origin cannot be proven by metadata alone; the outgoing callback demonstrates the behavior. A read-only authorization preflight returned HTTP 200 for the old callback but HTTP 400 for the Daily callback; a later rate-limit response ended further probing. The new callback is not verified and the production origin must not be flipped. Neither provider admin allowlists nor historical order-link ownership is established by HTTP 200 on the homepage.

## Dependency order and owner operations

1. **Release owner:** obtain two independent evidence-backed reviews of the exact final commit. Resolve introduced failures; identify existing failures by name. Keep the branch undeployed while blockers remain. Record a previous deployment reference and nonsecret configuration metadata for rollback.
2. **Shopify account owner:** inspect the existing Headless client for the supplements store `nr9zd0-t5.myshopify.com`; preserve all existing entries. Add/verify `https://www.iqondaily.com` as allowed JavaScript origin, `https://www.iqondaily.com/account/callback` as callback and `https://www.iqondaily.com/account/signed-out` as logout destination. Freshly navigate/read back entries. Do not use a Shopify-hosted root as a substitute for the headless storefront. Preserve subscription-management URLs and current identity/client/session secrets.
3. **Account release owner:** resolve login host coordination *before* changing `CUSTOMER_ACCOUNT_PUBLIC_ORIGIN`. The current code assumes login begins on the configured origin; neither DNS aliasing nor a global origin flip moves its host-only PKCE/session cookies. Design and review a narrowly scoped login handoff/gate for old www and new apex, or keep those login entrances unavailable during coordinated cutover. Allow already-started callbacks on their original host to finish. A global old-host redirect is not that solution and is prohibited until all surfaces are verified. Record expected session reauthentication after cross-domain navigation; do not export/copy browser cookies or rotate session secrets.
4. **IQON Health authority owner:** verify the approved supplements portal/relay origin on the canonical Health backend, including password-reset/invitation/cross-store links and any origin/signature checks. Preserve Health's URL and shared relay credential. Coordinate the Health allowlist and Vercel `SHARED_AFFILIATE_PORTAL_ORIGIN=https://www.iqondaily.com`; do not widen authorization to arbitrary hosts. Existing production+preview shared scope must be handled deliberately (create branch-specific preview config if needed); do not silently alter all preview deployments.
5. **Shopify webhook/email owner:** inventory actual webhook subscriptions for order/fulfillment topics and their delivery endpoints, separately from affiliate webhooks owned by Health. Preserve secrets and topic ownership. Verify the Daily webhook endpoint using an isolated synthetic fixture with sending disabled, then update the existing subscription callback once (avoid parallel subscriptions that can duplicate sends), preserving IDs where supported and confirming readback/delivery history. Keep the old endpoint serving retries. Do not replay real customer events.
6. **Email owner:** inspect `SUPPLEMENTS_EMAIL_ASSET_ORIGIN`, verified `SUPPLEMENTS_ORDER_EMAIL_FROM`/Reply-To and provider-managed templates/link destinations. Switch the asset override to Daily only after fonts, wordmark and all product images return successfully. Preserve verified sender and `info@iqonhealth.com` support identity; no MX/SPF/DKIM or sender-domain change is implied. Resend delivery/links are a separate verification gate; no customer sends or preview email sends are authorized here.
7. **Shopify commerce owner:** verify hosted checkout URLs, checkout return/account links and the real domain responsible for legacy `/.../orders/.../authenticate?key=...` URLs. The headless app must not be assumed to serve Shopify order-status routes. Use an owned existing synthetic order or provider admin evidence; do not create a purchase. Preserve exact token/query values privately. If provider admin cannot be reached or old deep links cannot be proven, record a blocker and retain old-domain service without redirection.
8. **Vercel release owner:** only after the previous dependencies and current-head review pass, configure the exact production customer/relay origins and deploy the approved commit. No database migration. Verify deployment completion/reference, actual configured behavior and protection status, not only a successful CLI return.
9. **QA/release owner:** perform owned synthetic sign-in through callback, durable session, scoped order/address reads and logout on Daily. Verify privacy access signed out, hosted subscription management, affiliate login/reads, and a cart checkout handoff without placing an order. Check both desktop/mobile render, callback errors, health logs and old-order links. Never include OTPs, codes, tokens or customer data in evidence. Mock tests do not satisfy these live gates.
10. **Domain owner:** consider old-domain/apex redirects only after every account, checkout, callback, webhook, affiliate and email/deep-link gate is verified. Review route exceptions and query/method preservation; do not redirect webhook POSTs or active callbacks blindly. This branch contains no domain redirect. Leave old domains attached until proven safe.

## Local proof and its limits

Use Node 22. `npm ci` generates Prisma. Commands:

- `npm run typecheck:next` and `npm run build:vercel` for the actual Vercel target.
- `node --import tsx --test tests/orders/*.test.ts tests/affiliates/*.test.ts` for mail/provider/relay behavior; compare any failures against the same tests on the base commit.
- `bash scripts/account-test-db.sh node --import tsx --test tests/customer-account/*.test.ts` for owned loopback PostgreSQL plus fake OAuth provider, now using Daily as the synthetic request origin. It cleans up its own cluster.
- `node --test tests/cart-routes.test.mjs` for real handlers against mocked Shopify transport on Daily, preserving hosted checkout and cross-origin rejection.
- `node --import tsx scripts/render-order-email-previews.ts --out docs/emails` regenerates previews locally without sending.

Auth tests verify explicit legacy-origin rollback, Daily callback/logout, host-only cookies and spoofed forwarding headers. Email tests preserve old and Shopify provider order links while migrating assets; relay tests reject stale/apex/forged origins. Full live OAuth, external allowlists, real subscription operations, paid checkout, mail delivery and redirect safety require owner verification and are not inferred from these tests.

## Rollback

Before release, capture the previous deployment and each exact config scope/value privately. If cutover fails, stop new Daily login entrances first; restore coordinated old customer/relay origins and Health allowlist, restore any changed webhook callback by its existing subscription ID, and redeploy the prior approved build. Restore `SUPPLEMENTS_EMAIL_ASSET_ORIGIN` if needed. Retain newly added Shopify allowlist entries until in-flight callbacks expire rather than deleting them immediately. Keep both domains attached and assets reachable, preserve webhook retry/idempotency records and customer/session/order data, and verify old-host sign-in/logout, affiliate reads and webhook health. Revert this commit for code rollback; do not drop tables or rotate credentials. Reopen failed live gates before another release attempt.
