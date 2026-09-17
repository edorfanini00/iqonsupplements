# One IQON affiliate program, two branded portals

## Authority and repository map

- **Canonical program, identity and financial authority:** `Juliovivas99/IQON`, Health portal `https://www.iqonhealth.com/affiliates`.
- **Supplements/skincare branded client:** `edorfanini00/iqonsupplements`, portal `https://www.iqonbody.com/affiliates`.
- This branch continues PR #4's existing affiliate UI and Shopify adapters. The earlier `edorfanini00/IQONwebsite` copy is provenance only, not the live Health platform.
- An implementation branch or passing build is not evidence that the shared service is configured or released. Check the release manifest and deployed commit before announcing cross-store support.

## Shared identity and routing

Health owns the existing WordPress/CoCart identities, affiliate profiles, approval queue, referrers, agreed rates, commission entries, messages, app integration, bonuses, rankings and payouts. Affiliates use the same existing credentials through either branded portal; they must not register a second account. Automatic browser SSO is distinct from sharing an account and is not implied.

The supplements server acts as a same-origin backend-for-frontend (BFF) for explicitly allowlisted affiliate routes. It forwards only the canonical session cookies to the configured Health authority, never Shopify credentials or arbitrary browser authorization/forwarding headers. Both domains use host-only HttpOnly cookies. Health still authorizes every user and administrator; the relay secret is not an admin credential. Invalid/missing upstream configuration must fail closed, not fall back to an independent supplements account database.

Required server-only supplements configuration:

- `SHARED_AFFILIATE_HEALTH_ORIGIN`: canonical Health HTTPS origin (production `https://www.iqonhealth.com`).
- `SHARED_AFFILIATE_PORTAL_ORIGIN`: exact supplements HTTPS origin (production `https://www.iqonbody.com`).
- `SHARED_AFFILIATE_RELAY_SECRET`: dedicated random secret of at least 32 characters, provisioned on both services. Do not reuse the WordPress, Shopify, bank encryption or auth-signing secrets.

Health also receives the expected portal origin and relay secret. Use a separate explicitly configured authority and secret for previews. Do not point a financial test preview at production. Origin checks, no-store responses, cookie flags, redirect rejection and server-side permissions are acceptance requirements.

## Do not initialize a second program

**Do not run the old independent supplements bootstrap or migrations as part of this rollout.** Do not create a new supplements affiliate database, reset accounts, import defaults over existing agreements, or create a supplements Supabase/RevenueCat project. The old copied persistence code/migrations may remain in Git for history; their presence is not permission to activate them.

Before disabling any previously configured independent service, inventory it read-only and preserve its records. If records exist, produce an explicit verified account mapping and financial reconciliation. Matching names is never an identity merge. Email alone is not proof that two accounts may be merged.

## Commerce boundaries

Peptides use Health's existing WooCommerce integration. Supplements and skincare use one Shopify storefront. The source adapter pins `nr9zd0-t5.myshopify.com`; verify the actual shop identity, USD/currency support, app scopes and product mappings with authenticated reads before enabling ingestion. Storefront API tokens cannot call the Admin API.

The **canonical Health service**, not this portal's independent writer, owns Shopify affiliate ingestion and code synchronization. Provision the scoped supplements Admin token, shop domain and signed-webhook secret there according to the canonical integration documentation. Do not reuse Woo credentials for Shopify or Shopify tokens for Woo. Never put Admin tokens in `NEXT_PUBLIC_` variables.

Products need evidence-backed supplement/skincare classification. Unknown products must be visible as unclassified/blocked, not guessed. Mixed orders are allocated by line, including discounts and refunds. Provider/store/order/line identifiers must remain namespaced; count a mixed order once in the combined view. Historical amounts/rates are preserved; new rates cannot reprice historical earnings.

A saved creator code is not proof of provider activation. Display successful activation only after verifying the exact owned discount and intended terms on that store. Conflicts and unsupported category-specific discount mechanisms must be explicit. A basic all-item Shopify percentage cannot implement two different category percentages; do not silently substitute one rate.

## Money and reporting

The existing Health ledger is the only payout authority. New payout requests use idempotency keys and monetary allocations, support partial earnings, include outstanding negative adjustments, and record administrator/time/method/reference. A reversal retains the original record and is audited. **Mark completed records a payment already made outside the portal; it does not initiate a transfer.**

Both portals use the same report endpoints and category/date/currency semantics. Sales revenue, affiliate earnings and completed payouts are separate measures. Business revenue cannot be inferred from affiliate-attributed revenue alone. Do not sum currency buckets without an explicit conversion policy. Show missing integrations, legacy revenue semantics, unknown categories and incomplete provider coverage rather than presenting partial totals as complete.

Existing app analytics come from Health's real Supabase and RevenueCat integrations. Do not invent a new app project or represent lifetime gross multiplied by today's rate as individual verified charge commissions. App charge ingestion requires a reconciled historical checkpoint, unique transaction identity and immutable applicable rate; unknown history blocks automatic accrual rather than replaying paid earnings.

## Single owner for jobs and notifications

Health is the only owner of program webhooks, reconciliation, app accrual, bonus/ranking settlement and notifications. Supplements affiliate cron/ingestion routes must remain disabled; remove duplicate schedules during coordinated release. All canonical job routes require their secret, not just an `x-vercel-cron` header. Analytics GETs must not mutate financial records.

Transactional email uses the existing canonical program configuration and verified sender. QA must not email actual affiliates or create real customer orders. Provider presence in an environment list is not proof of delivery or successful webhook registration.

## Release gates

1. Verify both deployed commits, project links, domains and branch ownership. Keep production unchanged during implementation.
2. Obtain a consistent full database backup and preserve auth/bank encryption material securely. Restore into a separate database and compare canonical content, not only counts. API/CSV exports are useful reconciliation evidence but are not a restorable backup.
3. Reconcile immutable affiliate IDs, creator codes, referrers, existing custom/zero rates, all unpaid entries, paid allocations, reversals, app entries and leaderboard history. Preserve program start dates and existing provider-order cutoffs.
4. Apply reviewed additive migrations to isolated staging first. Test concurrent payout actions, request retries, duplicate webhooks, mixed orders, partial refunds and post-payment adjustments against real PostgreSQL. Never use production credentials in tests.
5. Exercise both built portals over HTTPS with the same test account: applications, approvals, category rates, metrics, app, permissions, category filters/exports, partial payout refresh and desktop/mobile layouts.
6. Verify actual Shopify shop/scopes, product mapping, code readback, signed webhook registration, canonical job ownership and email delivery using staging/test transactions.
7. Only after backup/restore, historical reconciliation and acceptance pass: release the canonical backend first, then configure/release the branded client. Read both deployments back and repeat non-destructive checks.
8. Rollback must preserve new financial entries. Do not run a schema-down migration after partial/category data exists; prefer reverting client traffic with the expanded schema intact and pausing new ingestion.

## Local verification and known unrelated failure

Use an isolated PostgreSQL instance and explicit test variables. The original Health `npm run build` includes `prisma migrate deploy`; use `prisma generate` plus `next build` separately for verification. Do not casually run its build with production configuration.

The prior supplements test `tests/merchandise.test.mjs` has a confirmed pre-existing pricing-fixture mismatch (`55 !== 36`) identical to its merge base. Investigate the approved-prices vs product-range fixtures separately. **Do not change live prices to make this test pass.**

Final release evidence must list exact tests run versus skipped, commit/PR/deployment IDs, live connections verified versus missing, migration reconciliation results and remaining blockers. A mock-provider pass or successful Vercel preview is not an end-to-end release.
