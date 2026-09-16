# IQON Supplements affiliate portal

Ported from `edorfanini00/IQONwebsite` at `9a5673b5cc3ee57fce46b10a4a0f55cfba30292d`. Only the affiliate/admin application and its dependencies were adapted. No source customers, accounts, orders, credentials, or environment files were imported.

## Routes and features

| Area | Included |
| --- | --- |
| Public | Footer Affiliates link, branded landing page, application with recruitment/referrer link, login, password reset |
| Affiliate | Overview/charts, creator code, customers, recurring orders, network referrals, payment details, payout history, messaging, learning, notification settings, TikTok submissions, rankings and bonuses |
| Admin | Applications/approval, affiliate management and rates, order attribution, analytics, payout recording/reversal, rankings/prizes, TikTok program, accounting/inventory/expenses, notes, contact inbox, email campaigns, audit history |
| Shopify | Orders/customer/catalog reporting, owned affiliate discounts, signed webhook ingestion, resumable scheduled reconciliation, subscription contract list and pause/resume/cancel |
| Optional app | Separate supplements Supabase/RevenueCat integration, analytics and affiliate subscription commissions |

Typography, logo, neutral palette and public navigation follow the existing supplements storefront. Dashboards use a dedicated responsive sidebar. Education covers this store's collection; peptide protocols and the source 70% offer were removed.

## Independent connections

Create a **new Postgres database** for supplements. Tables have a `supplements_` prefix and the datasource only reads `SUPPLEMENTS_DATABASE_URL`. Native password accounts and revocable server-side sessions are independent of WordPress, Shopify customers, and Health accounts. Bank details require a separate encryption key (at least 32 random characters).

The Admin API client only permits `nr9zd0-t5.myshopify.com`, the store identified in this repository's existing setup. If `SHOPIFY_STORE_DOMAIN` is set, it must match. The Admin token only comes from `SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN`. No legacy key is used as a fallback. Shopify resource IDs are checked as safe integers and stored in Postgres float8 rather than a 32-bit integer.

Keep production and preview databases, Shopify apps, secrets and email configurations separate. Never put server credentials in a `NEXT_PUBLIC_` variable, git, client code or chat.

## Connect and initialize

1. Set the server environment values from `.env.example` in the supplements Vercel project: new database URL; supplements site origin; bank encryption key; supplements Shopify domain, Admin token and webhook secret; verified Resend sender and key; admin notification email; cron secrets.
2. Install an Admin API app on the **supplements store**. Required scopes for the core portal are `read_orders`, `read_products`, `read_customers`, `read_discounts`, `write_discounts`. Optional personal welcome discounts also require `write_customers`. Request approved `read_all_orders` access if reporting/backfill must include orders older than 60 days. Protected customer data approval may be required by the app type.
3. Run `npm ci`, then `npm run affiliates:migrate`. Builds generate the Prisma client but **never apply production migrations**.
4. From a trusted terminal, temporarily set `SUPPLEMENTS_ADMIN_EMAIL` and `SUPPLEMENTS_ADMIN_PASSWORD` (12–256 characters), then run `npm run affiliates:bootstrap`. The bootstrap creates the initial administrator, ranking start cycle, and order-sync cursor. It will not reset an existing administrator's password. Remove the bootstrap password afterward. `SUPPLEMENTS_AFFILIATE_START_AT` optionally sets the program's start date; otherwise it starts now. Earlier orders cannot earn commissions.
5. Configure Shopify webhooks for `orders/paid`, `orders/updated`, `orders/cancelled`, and `refunds/create` at `https://YOUR-SUPPLEMENTS-HOST/api/affiliates/webhooks/shopify`. Set `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` to the signing secret for those subscriptions. Signatures cover the raw request body; the endpoint also checks the exact shop domain. It fetches current Shopify order state before reconciling.
6. Vercel schedules daily backstops for sync, sales/TikTok bonuses, rankings, campaigns and optional app commissions. Set **both** `CRON_SECRET` and `SUPPLEMENTS_CRON_SECRET` to the same new value; Vercel supplies the first in its Authorization header. No endpoint trusts `x-vercel-cron`. More frequent schedules can be configured on a suitable hosting plan. Shopify webhooks provide immediate order updates.
7. Log in at `/affiliates/login`. Verify a test application, approval/coupon, qualifying order, refund and recorded payout before announcing the program. Without connection credentials, account and commerce operations report unavailable states.

Shopify API operations target `2026-07` and were checked against Shopify's schema. No live credentials were available during implementation, so the live store connection, webhook registration, real discount creation and email delivery still require this setup.

## Business behavior

New applications start with the source site's advertised **20% direct / 20% recurring commission and 15% customer discount**, editable by admins. Commission uses the order's current net product revenue, excluding shipping/tax and after discounts. USD is the supported ledger currency; other shop currencies fail closed. Self-purchases do not earn commission. Recurring attribution uses customer email, never a matching name.

An order and its referral commission commit together. Replayed notifications reconcile the same rows. Rates are captured with the original order, so later rate edits affect new orders. Partial refunds adjust pending commissions; refunds after payment create a visible negative adjustment for a future payout without rewriting the prior payment. Payout recording always includes outstanding negative adjustments and refuses duplicate/incorrect selections. Removing attribution prevents automatic re-crediting until an admin explicitly reassigns it.

Payouts are **records of payments made outside the portal**; the application does not initiate bank/PayPal/Zelle transfers. Refunds, returns, restocking and advanced subscription billing open the correct Shopify admin/app. The portal does not simulate a gateway refund or bring over the source Square/Stripe billing engine. Inventory shows Shopify on-hand counts for connected products and retains the separate purchases/adjustments ledger. P&L excludes collected tax from profit and uses a configurable shipping cost estimate (`SUPPLEMENTS_ESTIMATED_SHIPPING_COST_PER_ORDER`, default $6); review it for this business before using margins.

Shopify subscription mutations require the app to own the contracts and have `read_own_subscription_contracts` / `write_own_subscription_contracts`. Contracts owned by an existing subscription app are managed through that app. The page explicitly reports unavailable access rather than showing a false zero balance. Billing frequency, items and immediate charges are handled in the owning Shopify app.

The source ranking and TikTok reward programs are retained with admin-editable amounts. Review those amounts before launch. The personal welcome coupon is disabled by default; setting `SUPPLEMENTS_WELCOME_DISCOUNT_PERCENT` enables a one-use discount restricted to the affiliate's Shopify customer. Optional app analytics require separate supplements Supabase and RevenueCat configuration; there is no inherited project URL.

The contact form at `/affiliates/contact` writes directly to the new admin inbox. Contact messages and campaigns store only data in this database. Email campaigns include consented Shopify signup prospects; delivery stays disabled without a configured sender/key.

## Verification

- `npm run build:vercel` — Next production build and TypeScript checks.
- `npm run test:affiliates` — password, HMAC, encryption, store isolation, Shopify ID/normalization, commission and referral-cycle tests.
- Set `AFFILIATE_TEST_DATABASE_URL` to a **disposable local Postgres database** with this migration applied to run ledger tests. It must never target the live database.
- Also set `AFFILIATE_TEST_BASE_URL` to the local Next server connected to that database to run HTTP authentication/authorization, pending access, reset, revocation, CSRF and webhook tests.

Ledger and HTTP tests are opt-in and skip when their local services are absent. They were run against a disposable PGlite Postgres-compatible server during implementation; multi-process database concurrency still warrants staging validation against the chosen production Postgres provider.
