# Verification and limits

Application commit: `539d0b8`. Final fixture/test commit: `a4969f8` (subsequent evidence commit changes documentation and logs only). Base: `468996c53d6fde2864a94d1b44a06a6868050335`.

All commands use Node 22: `PATH=/opt/homebrew/opt/node@22/bin:$PATH`. PostgreSQL commands additionally use `/opt/homebrew/opt/postgresql@17/bin`. Full commands, intermediate failures and reruns are retained in `logs/`. A failed/interrupted earlier run is not a pass; the final relevant log is identified below.

## Successful checks

- Production Next build: `npm run build:vercel`; `logs/committed-build.log`.
- Worker build: `bash scripts/sites-env.sh -- node_modules/.bin/vinext build`; `logs/committed-worker-build.log`. The native wrapper `npm run build` cannot find GNU `timeout` on this Mac; its underlying build succeeds.
- TypeScript: `npm run typecheck:next`; `logs/committed-types.log`.
- Focused storefront components: nine Vitest files, 72 tests passed; `logs/review-head-ui.log`. Includes low genuine ratings, empty review honesty, bundles/keyboard, full supplement directions and all skincare ingredient explorers.
- Core/SEO/bundle/analytics/label/freeze tests: 66 passed, no skips; `logs/review-head-core.log`. Every frozen source/asset hash matches the base.
- Order emails including real database concurrency: 73 passed, no skips; `logs/final-orders-postgres.log`. Run with `scripts/account-test-db.sh`, exporting its throwaway local URL as `ORDER_EMAILS_TEST_DATABASE_URL`. Uses `FakeSender`; no emails are sent. This resolves the seven skips in earlier non-database runs.
- Real assets, all eighteen products, core routes, responsive/keyboard/reduced motion/200% text: 43 passed; `tests/e2e/premium-site.e2e.mjs`; `logs/committed-visual.log`.
- Commerce, actual asset delivery and collection/Help journeys: `QA_BASE=http://localhost:3990 QA_LOCAL_ASSETS=1 E2E_SCREENSHOTS=docs/qa/premium-site/real-assets-commerce node --test --test-concurrency=1 tests/e2e/purchase-clarity.e2e.mjs tests/e2e/premium-journeys.e2e.mjs`; `logs/https-assets-commerce.log`: 33 passed. The five journey checks were rerun after adjusting the capture scroll target: 5 passed in `logs/final-journeys.log`.
- Full geometry/state matrix: `E2E_PORT=4101 E2E_SCREENSHOTS=docs/qa/premium-site/spacing node --test --test-concurrency=1 tests/e2e/pdp-spacing.e2e.mjs`; `logs/committed-spacing.log`. 60 passed. Includes generic, sized, multiple-variant, unavailable, known supplement and skincare pages at 320/390/760/761/1440.
- Production SEO route matrix: `SEO_MATRIX_PORT=4001 node --test --test-concurrency=1 tests/seo/route-matrix.test.mjs`; `logs/committed-seo.log`: 26 passed.

Browser test counts and final statuses are also in `verification-results.json`; do not infer a pass from a file name alone.

## Baseline failures retained and reproduced

These are not storefront passes and are not release approval. Their underlying source is outside this change.

- Full component suite: 141 passed, 2 failed across 143 tests; one additional suite cannot import the absent sibling `iqon-health-rate-settings` checkout. Failures are two `original-relay-reads` expectations for HTTP 501 where current handlers return 400/403. `logs/committed-ui-all.log`; exact failing files reproduced at base in `logs/base-affiliate-ui-failures.log` (17 passed, 2 failed, same missing import).
- Affiliate integration: 188 passed, 13 failed, 4 skipped out of 205. Twelve historical file-digest parity expectations and one HTTP-authority expectation. `logs/affiliate-integration.log`; same thirteen failures at base in `logs/base-affiliate-integration.log` (19 passed, 13 failed for the selected files). No affiliate implementation changed.
- Account browser: 13 passed, 3 failed out of 16, reproduced exactly at base. Tests still expect old privacy text/no Meta script, and the sign-out test's provider log expectation also fails. `logs/release-account.log`, `logs/base-account-final.log`. All external browser requests are blocked by this suite; a logged attempted tracking URL is not a sent event.
- Account unit/integration: 67 passed, 2 cancelled out of 69. A mock hanging refresh has no referenced event-loop handle for its unreferenced abort timeout, cancelling that test and the next one. Same cancellation at base. `logs/final-postgres-tests.log` contains the combined 142-test run (140 passed, 2 cancelled); `logs/base-account-units.log` confirms the account-only baseline result. Order-email tests were separately rerun to a clean 73/73.
- Root tests: 56 passed, 3 failed out of 59 in `logs/committed-root.log`. Remaining failures: historical hosted-privacy byte comparison to `d7c9c06`, worker `__dirname` in ES module scope, and the Shopify test's data-URL loader failing to resolve `./legacy-redirects`. All three fail at base too (`logs/base-root-complete.log`, 37 passed/8 failed before correcting stale presentation assertions in this branch). No worker/runtime or privacy implementation was rewritten.
- Legacy layout suite: 53 passed, 3 failed out of 56 in `logs/final-layout.log`. The three failures assume the generic Daily Travel Kit has no bundle choices, which is already false on the base. Exact selected reproduction: `logs/base-layout-reproduction.log`, 3 passed/3 failed. The new commerce suite tests actual canonical behavior rather than changing offer eligibility to satisfy this stale assertion.
- Lint: 115 errors/81 warnings versus base 116 errors/79 warnings. No new errors. Fixed the existing Help internal-anchor error. Three new ordinary `<img>` advisories and one removed advisory give two net warnings; existing local WebP assets retain explicit dimensions/lazy loading. Most baseline errors concern affiliate hooks. `logs/complete-lint.json`, `logs/base-lint.json`, `lint-comparison.json`.

## Visual evidence

Real local preview uses the normal repository catalog and images. The live-mode fixture supplies isolated catalog/cart data with those same actual image paths served over loopback HTTPS on port 3991; it does not rewrite browser image requests or change screenshot pixels. See `tests/e2e/premium-catalog-hook.mjs`. The unmodified Shopify mapper requires HTTPS image URLs. The earlier `committed-commerce.log` passed behavior checks but its relative fixture URLs fell back to generic artwork, so it is not product-image evidence. The final HTTPS run asserts the exact creatine pack path and nonzero image dimensions; bag artwork was inspected. No production credentials are used. `QA_LOCAL_ASSETS=1` identifies synthetic commerce, not real Shopify data.

Full PNG artifacts stay in the local and external evidence directories, not in the source PR. The immutable comparison baselines and measurements are committed. Paths:

- `screenshots/home-{390,1440}-{top,full}.png`: consumer home and complete composition.
- `screenshots/collection-{390,1440}-{top,full}.png`, `all-*`: catalog/cards.
- `screenshots/colostrum-{390,1440}-{top,full,explanation,research}.png`, `creatine-*`: opening, explanation and research.
- `screenshots/*-390-story.png`: all eleven supplement stories; `*-390-full.png` also covers seven skincare products.
- `screenshots/approach-*`, `help-*`, `journal-*`: editorial/support pages.
- `screenshots/final-slider-{390,1440}.png`: comparison frame; every interior pixel matches the baseline. Only the last boundary pixel row is excluded because its fractional section edge blends with the following section. All source and image bytes, disclosure, controls and interactions are unchanged.
- `real-assets-commerce/`: current real-asset bundle/bag and collection/Help captures, including doubled live text.
- `spacing/`: all sixty geometry/state captures. Synthetic nonexistent-image fixture screenshots establish geometry only and are not product-media evidence.
- `synthetic-account/`, `synthetic-layout/`, `synthetic-purchase/`: explicitly synthetic regression captures, not evidence of live customer access or production imagery.

`first-paint.json` records fifteen initial-load observations before scroll or eager loading. Highest observed CLS was 0.0763; home was under 0.003. These are unthrottled local observations, not field Core Web Vitals or conversion claims. `screenshots/render-measurements.json` records ordinary fonts, nonzero image dimensions, containment and 16px/17px product introduction text. Its CLS includes a full-page scrolling/asset sweep and is separately labeled from initial-load measurements.

## Process and release status

`OWNED-PROCESSES.json` identifies the owned local servers. E2E runners stop their own servers; the two persistent previews and the local HTTPS asset server were stopped after final capture. `process-cleanup.json` confirms no listeners on the recorded owned ports. Disposable PostgreSQL clusters are stopped and removed by their existing harness. No unrelated process is stopped.

No merge or production deployment. Genuine signed-in hosted accounts/checkout are NOT CHECKED. Parent owns two independent exact-head reviews and authorized hosted preview approval. See `ACCEPTANCE.md` for all eighteen scope verdicts, data dependencies and rollback.

## Reproduction commands

After `npm ci`, run the builds and TypeScript commands above with Node 22. No production environment is needed. The fixture-only commerce capture requires three separate terminal processes; stop the two servers when the test exits:

```sh
# Terminal 1: generate a disposable certificate under ignored work/ and serve public/.
mkdir -p work
openssl req -x509 -newkey rsa:2048 -nodes -keyout work/qa-assets-key.pem -out work/qa-assets-cert.pem -days 1 -subj /CN=localhost
chmod 600 work/qa-assets-key.pem
node tests/e2e/premium-asset-server.mjs

# Terminal 2: isolated commerce, dummy credentials handled by the server fetch fixture.
FAKE_SHOPIFY=live FAKE_CATALOG=purchase-clarity SHOPIFY_STORE_DOMAIN=iqon-test.myshopify.com SHOPIFY_STOREFRONT_PRIVATE_TOKEN=test-token NODE_OPTIONS="--import tsx --import ./tests/e2e/premium-catalog-hook.mjs" node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3990

# Terminal 3: actual browser interactions; only loopback/CDN image origins allowed.
QA_BASE=http://localhost:3990 QA_LOCAL_ASSETS=1 E2E_SCREENSHOTS=docs/qa/premium-site/real-assets-commerce node --test --test-concurrency=1 tests/e2e/purchase-clarity.e2e.mjs tests/e2e/premium-journeys.e2e.mjs
```

The local certificate exception is confined to fixture browser contexts. It does not change the application or production URL validation. The normal visual suite uses `QA_BASE=http://localhost:3987` and a normal `next start` with empty Shopify domain/token. Geometry and SEO suites start/stop their own fixtures.

```sh
node_modules/.bin/vitest run --config tests/ui/vitest.config.mjs
node --import tsx --test tests/affiliates/*.test.ts
node --test tests/*.test.mjs
node --test --test-concurrency=1 tests/e2e/storefront-layout.e2e.mjs
bash scripts/account-test-db.sh bash -c 'export ORDER_EMAILS_TEST_DATABASE_URL="$ACCOUNT_TEST_DATABASE_URL"; exec node --import tsx --test tests/orders/*.test.ts'
```

Baseline reproduction exported tracked base files into ignored `work/base-regression`, sharing the installed dependencies and unchanged public assets, then ran the same selected failing suites and builds there. `baseline-restored-files.json` records files restored after an initially incomplete export. Only the final baseline logs cited above establish reproduction; incomplete attempts are retained for transparency.

Builder self-review checked the diff against the base and the eighteen acceptance groups. Corrections found during verification included generic desktop spacing, sticky purchase after an anchor jump, alternate-pack value guards, preview Help wording, and the HTTPS fixture artwork issue. Frozen skincare hashes, interior pixels and interactions pass. No backend, offer eligibility, auth, consent or attribution source was changed. This self-review does not substitute for the parent's two independent exact-head reviews.
