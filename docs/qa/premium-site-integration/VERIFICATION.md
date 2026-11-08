# Current-main integration verification

Main `a4c4b12d8d29608adecfea48609a00db298b7ff7` is integrated into the same feature branch and draft PR41. Original feature head: `da4a613f2b12ac92d0bc2832a7fb91424bb01100`. Merge: `c75345e`. Fixture reconciliation: `d996e61`. Final application/content head: `4b5dd2a`. The final evidence commit changes documentation only.

## Preservation and scope

All eighteen original acceptance groups remain implemented; the original ledger and build evidence are frozen, not rewritten. Main's Google attribution, Shopify privacy mount, native consent freshness/persistence, Meta consent reconciliation, checkout preparation and cart callbacks are authoritative. Thirty-one incoming files, including runtime, server, package and lock files, are byte-identical to main. The four combined files are `app/layout.tsx`, `app/store-shell.tsx`, `app/shop-pages.tsx` and `tests/e2e/storefront-layout.e2e.mjs`.

Layout retains the premium stylesheet and metadata alongside native Shopify privacy. Shell retains product-card facts, honest preview copy and consumer footer wording alongside the native preferences entrypoint and every main checkout/cart/consent path. The product page adds main's consent-event callbacks without changing gallery-first purchase order. The automerged layout test retains main's native checkout-anchor assertions and the feature's geometry assertions.

Visual inspection found remaining repeated jar/capsule counts in opening bullets. The final content commit removes these repetitions across ten supplements while keeping the pack information under the title, verified serving grid, full directions, cautions and ingredient amounts. No label data, canonical prices, eligibility or business policies changed.

All thirteen original skincare files match their frozen SHA-256 values. Fourteen preservation tests pass; actual slider interiors and keyboard/pointer behavior pass at phone and desktop. As in the original baseline, the one bottom boundary row is excluded from the pixel comparison because fractional edge blending depends on the following section. No skincare source, asset, control, disclosure or public image was altered. The original BUILD-RESULT and final-qa copy, plus repository premium-site evidence, remain byte-identical (1,220 files checked).

## Verification

Node 22 and lockfile dependencies are installed. New logs, screenshots and traces are under repository `integration-qa/` and copied to `/Users/edorfanini/.hermes/workspace/iqon-premium-site-20261107/integration-qa/`. Counts and source heads are in `results.json`.

- Next production build and TypeScript: pass on final application head.
- Worker production build: pass on the merge head. Subsequent application changes are opening highlight text only; runtime and dependency bytes remain identical. The existing GNU-timeout wrapper limitation on this Mac is unchanged; direct `vinext build` was used.
- Nine storefront component files: 72 passed on final content.
- Label/freeze, cart-route, native consent, Meta and built privacy guards: 63 passed on final content/build.
- Real-image visual suite: 43 passed on final content/build.
- Commerce and collection/Help journeys: 33 passed on final content/build.
- Product geometry/state matrix: 60 passed on final content/build.
- Production SEO route matrix: 26 passed on final content/build.
- New main's offline Google attribution suite: 14 passed; consent freshness: 15 passed; consent persistence: 14 passed. These ran on the merged application before the final copy-only cleanup. All native runtime and callback source is byte-identical at the final head; `after-native-tests-application.diff` records the only later application delta.
- Edited fixture lint: passed with no findings. Diff whitespace check passes.

The newly shipped `test:google-attribution` package command was exercised as its component steps: cart-route tests, consent/Meta units, production build, then native browser tests. Freshness and persistence browser suites ran serially on the same owned port. This avoids rebuilding the same application between independent checks while preserving every assertion.

## Failures reconciled against exact new main

- Root suite: integration 58 passed/2 failed of 60. Both remaining failure IDs also occur on `a4c4b12`: `renders development preview metadata` fails on generated worker `__dirname` in ES-module scope; `tests/shopify.test.mjs` fails because its data-URL loader cannot resolve `./legacy-redirects`. New-main full root result is 39 passed/7 failed of 46; five additional old presentation assertions were already corrected in the original feature. The old hosted-privacy parity failure no longer occurs.
- Account browser: integration and new main both 15 passed/1 failed of 16. The remaining test waits for obsolete text: “This site doesn’t run advertising or analytics tracking of its own.” The current hosted privacy page remains accessible and its native settings behavior is separately covered. Two earlier account failures did not recur in these new-main runs.
- Account units with disposable PostgreSQL: both 67 passed/2 cancelled of 69. Same hanging refresh timeout and following database-outage test are cancelled when the event loop has no referenced work.
- Initial bag unit failure reproduced on new main: its fetch mock mixed new checkout preparation with cart mutation calls. The fixture now routes endpoints separately, still asserts exact cart payloads, and additionally waits for a valid checkout link. All 72 focused component tests then pass.
- Initial SEO run and new-main reproduction both show 24 passed/2 failed (one failed child plus its parent), because the static hash checker treated Shopify's native action link as a missing page section. The test now asserts the single correctly labeled native footer entrypoint and separately validates all ordinary section anchors. The actual native action remains covered by unmodified browser tests.
- An early built-output guard was mistakenly started while Next was rebuilding and found `.next/static` absent. That failed attempt is preserved; the final 63-test run after the completed build passes.

Unrelated affiliate, order-email and complete lint sweeps were not repeated: their source is unchanged by this integration. Their old results retain their original base/date in the frozen BUILD-RESULT; they are not represented as fresh new-main passes or failure reproductions.

## Commands

Use `PATH=/opt/homebrew/opt/node@22/bin:$PATH`. Database commands also need `/opt/homebrew/opt/postgresql@17/bin`.

```sh
npm ci
npm run build:vercel
npm run typecheck:next
bash scripts/sites-env.sh -- node_modules/.bin/vinext build
node_modules/.bin/vitest run --config tests/ui/vitest.config.mjs tests/ui/answer-html.test.ts tests/ui/bag-recommendation.test.ts tests/ui/bundle-keyboard.test.ts tests/ui/product-storytelling.test.ts tests/ui/purchase-clarity.test.ts tests/ui/purchase-options.test.ts tests/ui/review-integrity.test.ts tests/ui/skincare-ingredient-explorer.test.ts tests/ui/supplement-product-story.test.ts
node --import tsx --test tests/verified-labels.test.ts tests/skincare-preservation.test.mjs tests/shopify-consent.test.ts tests/meta-pixel.test.ts tests/cart-routes.test.mjs tests/hosted-privacy-release.test.mjs
E2E_PORT=3988 E2E_SCREENSHOTS=integration-qa/google node --test tests/e2e/google-attribution.e2e.mjs
E2E_PORT=3988 E2E_SCREENSHOTS=integration-qa/freshness node --test tests/e2e/consent-freshness.e2e.mjs
E2E_PORT=3988 E2E_SCREENSHOTS=integration-qa/persistence node --test tests/e2e/consent-persistence.e2e.mjs
QA_BASE=http://localhost:3987 E2E_SCREENSHOTS=integration-qa/screenshots-final node --test tests/e2e/premium-site.e2e.mjs
QA_BASE=http://localhost:3990 QA_LOCAL_ASSETS=1 E2E_SCREENSHOTS=integration-qa/commerce-final node --test --test-concurrency=1 tests/e2e/purchase-clarity.e2e.mjs tests/e2e/premium-journeys.e2e.mjs
E2E_PORT=4101 E2E_SCREENSHOTS=integration-qa/geometry-final node --test --test-concurrency=1 tests/e2e/pdp-spacing.e2e.mjs
SEO_MATRIX_PORT=4001 node --test --test-concurrency=1 tests/seo/route-matrix.test.mjs
node --test tests/*.test.mjs
bash scripts/account-test-db.sh node --import tsx --test tests/customer-account/*.test.ts
E2E_PORT=3995 E2E_SCREENSHOTS=integration-qa/account bash scripts/account-test-db.sh node --test --test-concurrency=1 tests/e2e/customer-account.e2e.mjs
```

Persistent visual and commerce servers use the original documented fixture setup, with new log/output destinations; actual assets are served over loopback HTTPS3991. Normal preview uses3987; synthetic commerce uses3990. Native consent suites serve archived unmodified vendor scripts and synthetic upstream responses while aborting all non-fixture external requests. GPC and external request blocking protect ordinary storefront QA. No production orders, emails, consent writes, settings changes or fabricated live attribution events occurred.

## Evidence and limits

Final imagery: `screenshots-final/` and `commerce-final/`. Native banner/preferences captures in `google/` demonstrate native UI interactions using isolated settings; their deliberately blocked catalog images are not product-media evidence. `geometry-final/` captures demonstrate synthetic geometry. Original pre-cleanup integration captures/logs are retained separately.

Genuine hosted account/checkout access, real Google purchase receipt and production consent continuity are NOT CHECKED. Parent owns two independent exact-final-head reviews and any authorized hosted preview/release. No PR merge, main update or deployment was invoked. Rollback the feature through the parent's normal release process while retaining main's already shipped attribution/consent changes; do not revert PR40.

All owned test/build processes completed. Persistent servers were stopped; all thirteen known owned ports have no listeners. Process IDs and checks are recorded in `owned-processes.json` and `process-cleanup.json`.
