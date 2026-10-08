# IQON Body tracking: safe installation, activation blocked

Dataset `1006368245818889`, IQON Body Web; ad account `1600704801853649`.

This release closes unsafe delivery paths. It does **not** claim live conversion tracking. Normal browser events, public relay events and production Purchase are fail-closed. No paid traffic, real charged order, fulfillment, emails, payment-mode changes or normal-production synthetic Purchase are authorized.

## Current behavior

- Browser SDK and preferences UI stay invisible while the reviewed route allowlist is empty. The preference implementation requires explicit advertising opt-in, offers decline/withdrawal, and honors GPC. Enabling routes later requires independent review. No health-data eligibility is inferred from Meta's displayed category.
- `/api/meta/track` POST returns `skipped:relay_controls_unverified`. Same-Origin is only a browser CSRF defense, not authentication. No environment variable can turn the relay on. Streaming bodies are capped at 4,096 bytes with a total two-second deadline.
- GET reports only pixel ID, token-present boolean and false activation booleans. Configuration present is not delivery evidence.
- `/api/webhooks/shopify/meta-purchase` authenticates exact raw bytes with timing-safe HMAC using **META_SHOPIFY_WEBHOOK_SECRET only**. It never falls back to the order/email secret. One-megabyte streaming cap, two-second read deadline. Tracking's transitive runtime graph excludes all email, fulfillment, admin and order integration modules.
- Absent/negative consent and GPC fail closed. Health route/variant allowlists are empty. Freeform product names, arbitrary hosts and sensitive URLs cannot be transmitted. Production Purchase remains gated even if a cart grant exists: cart attributes cannot prove current hosted-checkout consent or withdrawal.
- Valid original `processed_at`/`created_at` timestamps are preserved; missing, invalid, future or older-than-24-hour timestamps are skipped. No stale conversion is rewritten to now. Synthetic retries keep the same `purchase_<numeric order ID>` and time. This bounded retry policy is not a durable exactly-once guarantee.
- Attribute writes use abortable Shopify transport, awaited through completion/abort before checkout response. Withdrawn/absent preference writes `denied` and empty matching fields, preserving other attributes. Failure to clear an existing grant blocks only that checkout handoff with a retry message. Failure without a previous grant permits unattributed shopping.
- Errors contain only fixed codes and HTTP status; upstream bodies and exception text never enter results/logs.

## Safe server test boundary

Required server variables: `META_CAPI_ACCESS_TOKEN`, a real temporary `META_CAPI_TEST_EVENT_CODE`, and dedicated `META_SHOPIFY_WEBHOOK_SECRET`. Optional `META_GRAPH_VERSION` defaults to `v24.0`; public pixel ID defaults above and supports `off`.

The manual Shopify webhook signing credential was exposed during operational setup; it is **not usable** for this route. Actual Shopify webhook registration remains blocked until an unexposed app-owned credential is configured. The owner can generate a separate 256-bit dedicated secret for a signed synthetic production-route test; that secret does not establish a Shopify webhook subscription or prove Shopify delivery.

The only active webhook delivery path requires all of:

1. Valid brand shop/topic/HMAC, `test:true`, actual Test Events code.
2. `_meta_consent=granted-v1` and `_meta_test_fixture=synthetic-v1` note attributes.
3. Fresh original timestamp, numeric order ID, and only synthetic variants `8001`, `8002`, `8003`.
4. No renewal signal.

The transmitted test user data is replaced with the fixed `IQON synthetic tracking verification` user agent; no email, phone, address, customer ID, IP or advertising cookie is transmitted. Source is the canonical homepage; custom data uses only numeric synthetic IDs and purchase totals. See `docs/tracking/synthetic-order.mjs` for the fixture factory. Do not invoke this with real customer/order data. Remove the Test Events code after verification.

An accepted Meta response proves acceptance only. Events Manager visibility must be independently observed. Local matching event IDs do not prove Browser+Server deduplication; real checkout consent transfer, browser Purchase and purchase end-to-end remain NOT VERIFIED. No recommendation to create charged orders or change live payment modes.

## Shopify custom pixel

Standalone reviewable source: `docs/tracking/shopify-meta-purchase.js`. Configure permission **Required: Marketing** and data-sale classification **qualifies as data sale**. It reads `init.customerPrivacy`, subscribes via `api.customerPrivacy` to `visitorConsentCollected`, and requires marketing/data-sale permission at each checkout event. GPC revokes permission. With no approved variants, it sends nothing and loads no SDK. Keep it disconnected until activation review; do not paste the earlier permissive snippet.

Official API reference: https://shopify.dev/docs/api/web-pixels-api/pixel-privacy . Sandbox URL minimization and current-consent transfer remain separate gates, because fbq can collect URL context independently of explicit custom data.

## Concrete activation work (requires fresh review)

Production relay requires signed, short-lived first-party provenance bound to a server-controlled anonymous session, plus durable atomic rate limits and event replay claims. Origin headers or process-local Maps are insufficient. Rate/replay reads and writes must fail closed. A future dedicated tracking schema in the existing Postgres can store hashed session IDs, consent version/status, revocation time, unique event ID, original timestamp, send status and expiry. It must be separately migrated/reviewed, with no reuse or changes to order/email tables. No DB mutation is part of this release.

Purchase requires a supported Shopify current-advertising-consent integration including withdrawal while/after hosted checkout, linked to the dedicated consent record; expired/unknown consent cannot send. Claims must use unique `purchase_<orderid>`, preserve original time, allow retry after transient or ambiguous send without duplicating downstream identity, and expire outside the bounded retry window. Claim success must follow awaited delivery. Independently test concurrent/replayed requests and revoked sessions.

An authorized privacy/health eligibility review must approve specific routes/variants/event uses before adding allowlist entries. An unapproved item makes the whole cart/order ineligible. Do not strip the name and then send a restricted purchase, rename it to another event, or use CAPI to bypass Meta restrictions. Current dataset classification is not such approval.

## Verification and rollback

Commands: `npm run test:meta`; `node --test tests/cart-routes.test.mjs`; `npm run typecheck:next`; changed-file ESLint; `npm run build:vercel`. Tests use synthetic fixtures and mocked transports. Independent exact-SHA review and live deployment evidence are separate release gates.

Disable server test delivery by removing `META_CAPI_TEST_EVENT_CODE` or the CAPI token. Disable the public pixel with `NEXT_PUBLIC_META_PIXEL_ID=off` and redeploy. Disconnect the dedicated custom pixel; remove only the dedicated tracking webhook if one is later registered. Revert the focused code commit if necessary. No migrations or order/email configuration rollback is required.
