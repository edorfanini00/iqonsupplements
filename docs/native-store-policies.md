# Native store policy pages

The five policy links in the footer, Help and subscription terms open branded
`/policies/[slug]` pages. Shopify remains the source of policy wording; there is no
policy copy or merchant identity data stored in this repository.

## Published source and bounds

On 22 October 2026, all five public endpoints below returned HTTP 200 with
`application/json` and a matching `policy.handle`, nonempty `policy.title` and
`policy.body`. They require no token. This is the published JSON alternative
explicitly authorized in the round-2 brief; no theme HTML is scraped and no Admin
write is performed.

- `https://nr9zd0-t5.myshopify.com/policies/refund-policy.json`
- `https://nr9zd0-t5.myshopify.com/policies/shipping-policy.json`
- `https://nr9zd0-t5.myshopify.com/policies/subscription-policy.json`
- `https://nr9zd0-t5.myshopify.com/policies/terms-of-service.json`
- `https://nr9zd0-t5.myshopify.com/policies/contact-information.json`

The Storefront API version, credentials and commerce requests are unchanged.
`store-policy-content.server.ts` requests only these fixed URLs, refuses redirects,
limits each decoded response to 128 KiB, and aborts fetching/reading after five
seconds. Its per-process cache holds at most five entries for 60 seconds, coalesces
concurrent reads and retries failed reads after five seconds. Expired policy text
is not served indefinitely after failures. React request memoization keeps the
metadata and body on the same snapshot.

`sanitize-html` allows text structure and ordinary links, removes executable
markup, media, forms, styles and unwanted attributes, and demotes supplied H1s to
H2s. Known Shopify policy links are rewritten to their native equivalents. Other
allowed links, including any secure subscription manager links, retain their
URLs. The currently published bodies contain paragraphs only.

Missing, invalid, oversized, timed-out or failed responses show an explicit
unavailable message and a link to the matching published Shopify policy. Such
pages have `noindex, follow`; successful pages can be indexed on the canonical
production host only. Both have a clean `https://www.iqondaily.com/policies/...`
canonical. Unknown slugs return 404. Existing privacy and account routes stay as
they are. Policy discovery is through footer/Help links; no policy schema or
sitemap behavior was added.

## Verification

Use Node 22 (verified with 22.23.2). The normal offline tests use synthetic Shopify
catalog and policy data; they never create orders or send notifications.

```sh
npm run typecheck:next
npm run test:seo
npm run test:layout
npx vitest run --config tests/ui/vitest.config.mjs tests/ui/purchase-options.test.ts
```

`test:seo` includes the policy unit tests, a local `build:vercel` production build,
and the actual-server route matrix. Tests cover all five source/native/fallback
mappings, missing credentials, unknown slugs, sanitized SSR, canonical and alias
metadata, preview indexing, outages, malformed content, response bounds, stalled
body timeout, cache expiry, recovery and concurrent reads. Layout tests include
the existing synthetic product → bag → checkout handoff and all five policy pages
at 320, 390 and 1440 pixels.

For read-only integration with the actual published policy JSON, after the build:

```sh
FAKE_POLICIES=published E2E_PORT=3941 E2E_SCREENSHOTS=/tmp/iqon-policies-published \
  node --test --test-concurrency=1 --test-name-pattern='all five native policies' \
  tests/e2e/storefront-layout.e2e.mjs
FAKE_POLICIES=down E2E_PORT=3942 E2E_SCREENSHOTS=/tmp/iqon-policies-fallback \
  node --test --test-concurrency=1 --test-name-pattern='all five native policies' \
  tests/e2e/storefront-layout.e2e.mjs
```

The published mode uses the real JSON over HTTPS and compares each rendered title
and full body text to that endpoint at each width. The surrounding catalog remains
synthetic; these are local production-build captures, not deployed screenshots.
The outage mode captures all matching fallback links and checks noindex metadata.

Two unrelated baseline checks remain: `app/store-shell.tsx` has two pre-existing
`react-hooks/set-state-in-effect` lint errors; the hosted-privacy release guard
has one failing byte-equality test against historical commit `d7c9c06`, reproduced
on the original PR head `e1e5eea` (`lib/shopify-operations.ts`). The other four
privacy guards pass. Account, cart and checkout files have no diff against the
current main branch.

## Release handoff

Feature-delivery gates 1–7 are covered by the stated scope, current-main inspection,
bounded implementation, local validation, self-review and updated PR #28. Gate 8
is assigned to the parent for two independent reviews of the final pushed head.
Gate 9 has local production-build integration with the actual published policy
source; deployment-specific verification remains outstanding. Gates 10–13
(approval/merge, deploy, production verification and release closure) are expressly
held by the brief. This change is **In review**, not deployed or shipped.

No migrations or environment changes are needed. Deploy only after review and
approval. Then verify all five routes on the canonical host, content parity with
Shopify, footer/Help/PDP navigation, alias noindex behavior, and existing secure
subscription/account/checkout paths. The JSON endpoint shape is an external
dependency; if it changes or is unavailable the matching Shopify link is the
fallback (and may show Shopify's generic theme). To roll back, revert the native
policy commit; the prior PR commit restores direct published Shopify links.
