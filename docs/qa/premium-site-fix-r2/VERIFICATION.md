# R2 — mobile collection composition

At reviewed head `51b384407d033c4c0c7072d3a958413cd0be8acf`, Training’s first product began at **840.203125px** in a normal **390×844** viewport. The controls passed functional tests but consumed almost the entire opening. This bounded correction moves both existing guide links after the product grid in DOM order, reuses the existing introduction for focus descriptions, and reduces supplement-only toolbar spacing and duplicate separators. Sort labels can wrap when text is enlarged. No filter, product or important type was removed or reduced.

Only application files `app/collection-page.tsx` and `app/collection-focus.css` change. Focus membership, format/search/sort/history/reset, stock/price and canonical policy remain unchanged. All-products and skincare retain their prior markup/behavior. No assets, backend, consent, attribution, cart, checkout, label tables or product-page rules change.

## Actual normal viewport measurements

Measurements are from scrollY=0 with full site chrome, loaded original images and synthetic catalog data. Mobile height is **844px**, not the previous suite’s 900px. Both the first card and image begin at the reported position.

- **390×844:** All, Training, Everyday nutrition and Digestive support each begin at **623.25px** (limit650px). The first image’s entire **198.75px** height is visible. Training improves by **216.953125px** from the independently observed old head.
- **320×844:** All, Everyday nutrition and Digestive support begin at **651.8125px**; Training at **624.625px** (limit720px). The first image’s entire **155px** height is visible.
- **1440×900:** All begins at644.859375px; the three focused states at617.671875px. Search, count and sort remain aligned horizontally; controls wrap normally on mobile.

Computed mobile type remains heading38px, introduction17px, focus14px and search16px. At 200% the test measures76/34/28/32px respectively; it also doubles the visible format, count, sort and reset text. Enlarged layouts may scroll vertically and are intentionally exempt from the normal-text fold thresholds. Text ranges fit horizontally, actual clipping is absent, focus controls do not overlap and no horizontal page overflow occurs. Sort can wrap without truncation. Input text retains normal single-line input behavior.

Inspected [320px All](screenshots/all-320-viewport.png), [390px Training](screenshots/training-390-viewport.png), [desktop nutrition](screenshots/nutrition-1440-viewport.png), [200% heading/filter text at320px](screenshots/focus-text-200-320.png), and [guide links after products](screenshots/guides-390.png). Full-page and normal-viewport captures for every measured state are in separate `fix-r2-qa/browser-complete/` evidence. No chrome hiding or screenshot-only image substitution.

## Verification

Node22, completed production build with existing synthetic Shopify boundary and original image assets served normally over loopback HTTPS. No real orders, tracking events, emails or other external mutations.

- **10/10 component tests:** existing membership/filter behavior plus introduction reuse and both guides after products in DOM order.
- **42/42 targeted browser/SEO/protected-layout checks:** 320/390/1440, all focus groups, formats, search, sort, Back/Forward/reload, resets, unknown/repeated inputs, unavailable/empty/outage states, real images, keyboard selection and actual sequential Tab access from the last product to both relocated guides. New assertions enforce normal first-card thresholds and visible real image height.
- SEO includes **25 HTTP responses** across five query shapes and existing host/catalog indexability combinations. Clean canonical and index/noindex policy remain unchanged.
- Protected Colostrum opening remains16px size-to-description spacing,16px mobile/17px desktop body and gallery-first DOM. Frozen skincare slider interior pixels match the original390×844/1440×900 baselines; ArrowRight/Home/End pass. The pre-existing single bottom boundary-row comparison exception is retained.
- **20/20 buyer-path/skincare preservation tests:** all thirteen frozen files and the mount assertion remain intact.
- Next production build, worker production build, TypeScript, changed-source ESLint and `git diff --check`: **PASS**. Worker uses the established direct vinext command because of the Mac GNU-timeout wrapper limitation.

The new composition assertions were run against the existing51b3844 production build before rebuilding. They failed for All803.8125px, Training840.203125px and the other two focuses862.59375px at390×844. This independently reproduces the parent’s Training receipt. Parent original screenshot/DOM receipt and this executable RED run are preserved under `fix-r2-qa/red/`.

Diagnostic artifacts remain separate. The initial corrected layout passed39/39. During expanded verification, a new vertical text-range test initially mistook visible font overhang for clipping; that attempt was stopped and its owned processes cleaned up. The corrected check tests horizontal fit and vertical clipping only where overflow is actually clipped. A subsequent test initially failed to enlarge an existing `!important` eyebrow font; the helper now applies actual200% font sizes with precedence and excludes invisible elements. Final42/42 passes on the final source. Neither diagnostic required an unrelated application change.

## Preservation and review boundary

Hash verification covers **4,304 unchanged prior evidence files**, including earlier reports, frozen R1 evidence and collection-scope evidence. Across859 baseline source/test/assets/dependency files, only the two collection application files and two focused test files change; **855 remain byte-identical**. See [preservation receipt](preservation.json). All earlier table/CFU/gap fixes, native consent and frozen skincare assets/code are untouched. The unchanged237-table matrix and broad historical suites were not repeated or relabeled as new results.

This directory, two updated tests, two collection application files and `fix-r2-progress.log` comprise the commit. Final source hashes, full logs, normal/enlarged screenshots, process receipts and old evidence inventory live in separate `fix-r2-qa/`. External `FIX-R2-RESULT.md` records exact pushed head and final freeze. Earlier reports remain unedited.

Owned asset/Next servers on3991 and4030–4033 are stopped; unrelated processes were left alone. Same draft PR41. No merge or manual deployment. The authorized branch push may trigger the repository’s automatic non-production Vercel preview. Parent owns two independent exact-final-head re-reviews and actual hosted preview inspection; those are not claimed complete here. No migrations or dependency changes.

## Reproduction

Use Node22 and existing local test certificates under ignored `work/`, or supply `QA_ASSET_KEY`/`QA_ASSET_CERT`. No private key is included in evidence.

```sh
npm run build:vercel
npm run typecheck:next
bash scripts/sites-env.sh -- node_modules/.bin/vinext build
node_modules/.bin/vitest run --config tests/ui/vitest.config.mjs tests/ui/collection-focus.test.ts
node_modules/.bin/eslint app/collection-page.tsx tests/ui/collection-focus.test.ts tests/e2e/collection-focus.e2e.mjs
node --import tsx --test tests/seo/buyer-paths.test.ts tests/skincare-preservation.test.mjs
QA_ASSET_KEY=work/collection-scope-key.pem QA_ASSET_CERT=work/collection-scope-cert.pem E2E_SCREENSHOTS=/tmp/iqon-r2 node --test tests/e2e/collection-focus.e2e.mjs
```
