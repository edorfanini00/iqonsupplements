# Review correction round 1

A1/B1, A2/B2 and A3 are **FIXED** in this candidate. The parent must obtain independent reviews of the exact new head; this is not approval. Same draft PR41, base `a4c4b12d8d29608adecfea48609a00db298b7ff7`; previous reviewed head `2059516eda319a35817c5a39c10a75d79bdfd85d`. No merge/deployment.

## Findings and proof

- **A1/B1:** Removed inherited 75% first-column width and numeric nowrap. Both formula copies use scoped table widths; narrow verified tables place each nutrient above amount/Daily Value, with flex wrapping at word boundaries. Captions, row/column headers, explicit accessibility roles, notes and every printed amount/unit remain. Wide tables retain three columns. No global financial-table rule changes. [390px normal lower table](screenshots/glp-1-support-390-story-verified-1x.png), [320px 200% lower table](screenshots/glp-1-support-320-story-verified-2x.png), [390px 200% upper table](screenshots/glp-1-support-390-opening-verified-2x.png).
- **A2/B2:** Active GLP-1 selector and expanded detail agree on separately printed 166 mg and 6 billion CFU; manufacture/expiry timing is explicitly unspecified. Legacy presentation copy is corrected, without misidentifying it as the current gallery. The eleven-product audit also corrected stale Liver Support dose/artichoke and Gummies nutrient-amount statements. Honest caffeine/proprietary-component/viability unknowns remain. [Desktop active selection](screenshots/glp-1-1440-selected.png), [content audit](CONTENT-AUDIT.md).
- **A3:** Removed the old mobile margin `!important`; the purchase-first summary/description gap has a single 16px owner. All six requested mobile measurements (Colostrum, Creatine, Gummies × 320/390) are exactly 16px, with 16px body text. Three desktop measurements retain 16px gap/17px body. Gallery DOM order is unchanged. [Colostrum mobile opening](screenshots/colostrum-powder-390-opening.png).

## Actual verification

Node 22; local production Next builds and original project assets; external browser requests blocked. No orders, emails or real tracking events.

- Next production build, separate TypeScript check, worker production build and changed-source ESLint: PASS. Worker uses the existing direct `vinext build` fallback for this Mac's GNU-timeout wrapper limitation.
- Focused storefront UI: **87/87** (72 existing + 15 new). Tests render all eleven verified tables; verify exact values/notes/headers; cover missing/unknown label and no-amount fallback; select live GLP-1 ingredient content; cover legacy corrections and retained unknowns.
- Label/frozen skincare/cart/native-consent/Meta/built-privacy checks: **63/63**, rerun after the final build. Includes all thirteen frozen source/assets hashes and skincare mount check.
- Final readability browser suite: **237/237** including 33 parent cases, **132 actual verified table renders** (11 products × 3 widths × 2 locations × 2 scales), **60 fallback table renders**, 9 opening measurements and 3 GLP selection checks. Zero text overlaps or cell/table clipping. Actual computed text including nested notes is doubled; verified amounts and Daily Values never break within words. Every row is compared with its data source and accessibility roles remain exposed. Fallback evidence explicitly inserts a server render of the production component without a verified label into the same production CSS/accordion context; it is synthetic fixture coverage, not a live alternate-pack claim. Products without fallback amounts render no table.
- Final real-image visual suite: **43/43**. All eleven supplement stories, all seven skincare preview pages, home/collections/Approach/Help/Journal, viewport boundaries, navigation/gallery keyboard, 200% text and frozen slider pixels/keyboard/pointer. Actual assets load without screenshot replacement. Slider comparison retains the original documented exclusion of the fractional bottom boundary row.
- Geometry/state suite: **60/60** on the first correction build, before the final formula-table-only intrinsic-word wrapping adjustment. Gallery focus, desktop original-flow comparison, responsive purchase states and unavailable/generic pages passed. The later CSS change touches only open verified table rows, none of these geometry selectors; final opening/gallery assertions and all 43 real-image checks ran again on final application bytes.

New regression tests also ran against the prior completed production build (application source identical to reviewed 2059516): 390/1440 reproduction produced 14 failures/12 passes, including real text collisions, the 37px gap and old CFU denial. The earlier 320 diagnostic produced 11 failures/2 passes. These are retained negative controls, not final failures. An initial new unit test used the wrong legacy mechanism index (13/14 new tests passed); the selector was corrected and all 87 scoped UI checks passed.

An accidentally broad UI run produced 155 passes, two unrelated original-relay status failures (400/403 vs expected 501), and a settings-cross-portal import failure for a missing sibling project. Those files were not changed; these failures were not re-baselined this round. Full output remains in `logs/ui-final.log` (historical filename; not the scoped final result). The relevant scoped result is `logs/storefront-ui.log`. No unrelated root/account/native-browser sweeps were repeated. Their exact baseline results and integration-specific native Google 14/freshness 15/persistence 14, commerce 33 and SEO 26 evidence remain in the immutable integration report and are **reused, not represented as new executions**.

## Preservation and evidence

All eighteen acceptance groups and new-main integration remain intact. Thirty-one incoming authoritative files match main byte-for-byte; those and the four combined integration files match the reviewed candidate. No runtime, account, consent, checkout, data-contract, package, lockfile, recovered label data or public asset changes. All thirteen skincare freeze hashes match. All **1,813** prior external reports/evidence and tracked historical QA files remain unchanged.

Full round evidence is separate: `/Users/edorfanini/.hermes/workspace/iqon-premium-site-20261107/fix-r1-qa/`. It contains positive/negative logs, full range geometry, actual opening measurements, real image screenshots, source/hash manifests and process cleanup. `readability-final/` is the final table evidence; `visual-final/` is the final full visual evidence. Table close-up screenshots hide only sticky header/section-navigation/skip-link chrome during capture to avoid obscuring a tall table; metrics are measured unmodified, and ordinary page screenshots retain normal chrome. The first `readability/`/`visual/` captures precede the intrinsic-word refinement and are retained separately. An isolated CSS experiment image is diagnostic only.

All owned processes completed and ports 3987/4101/4103 were stopped. Exact final SHA, remote/draft confirmation and final evidence inventory are in external `FIX-R1-RESULT.md` and `fix-r1-qa/handoff.json`. Genuine hosted purchase receipt, production consent continuity, cross-browser/screen-reader testing and independent corrected-head approval remain **NOT CHECKED** by this worker. Parent owns re-review and any later authorized release.

## Reproduction

Use `PATH=/opt/homebrew/opt/node@22/bin:$PATH` and a completed build. Normal preview server: clear Shopify domain/private-token and Meta pixel variables, then `next start -H 127.0.0.1 -p 3987`. Use fresh output directories; copy the original two baseline slider PNGs into the visual suite output before running it.

```sh
npm run build:vercel
npm run typecheck:next
bash scripts/sites-env.sh -- node_modules/.bin/vinext build
node_modules/.bin/vitest run --config tests/ui/vitest.config.mjs tests/ui/answer-html.test.ts tests/ui/bag-recommendation.test.ts tests/ui/bundle-keyboard.test.ts tests/ui/product-storytelling.test.ts tests/ui/purchase-clarity.test.ts tests/ui/purchase-options.test.ts tests/ui/review-integrity.test.ts tests/ui/skincare-ingredient-explorer.test.ts tests/ui/supplement-product-story.test.ts tests/ui/supplement-label-consistency.test.ts
node --import tsx --test tests/verified-labels.test.ts tests/skincare-preservation.test.mjs tests/shopify-consent.test.ts tests/meta-pixel.test.ts tests/cart-routes.test.mjs tests/hosted-privacy-release.test.mjs
QA_BASE=http://localhost:3987 E2E_SCREENSHOTS=/tmp/iqon-readability node --import tsx --test tests/e2e/supplement-readability.e2e.mjs
QA_BASE=http://localhost:3987 E2E_SCREENSHOTS=/tmp/iqon-visual node --test tests/e2e/premium-site.e2e.mjs
E2E_PORT=4101 E2E_SCREENSHOTS=/tmp/iqon-geometry node --test tests/e2e/pdp-spacing.e2e.mjs
```
