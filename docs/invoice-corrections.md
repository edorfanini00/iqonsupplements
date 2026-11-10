# Invoice eight — local review candidate

Status: **PR-ready; independent reviews pending. No push, PR, merge or deployment.**

Base: `fdf4ccf3088569e7503d864a3b8210896ce6fa7d` (current origin/main).
Branch: `fix/invoice-eight-corrections`.

## Scope and evidence

- IQON Daily / Shopify (`edorfanini00/iqonsupplements`), not IQON Health/Woo.
- Complete approved-label INCI and directions for the retained five, reused in both panels. Use FAQs and brief routine summaries corrected; Retinol Rx warnings and full Pads Sunburn Alert preserved.
- Source fixture is independently transcribed from visible approved proof pages 2–9. Its source ledger is `tests/fixtures/approved-skincare-labels.sources.json`. Eye uses the actual p2 formula, not the erroneous historical manifest. Day Cream uses visible p7 directions, not stale selectable text. Approved artwork is not batch confirmation.
- `lib/skincare-identity.ts` defines the current eight. Shared catalog, search, all PDP switchers, related cards, comparisons, routine links and sitemap follow it. All eight remain Coming soon with no usable price, stock, variant or Offer.
- Earlier Anti-Aging Cleanser with Peptides and Hydrating Tonic retain their original copy/body/art on direct 200 URLs, marked not part of current range, non-orderable and noindex. No formula-equivalence redirect or Shopify product/order deletion.
- Existing exact-handle defenses now cover all eight plus two historical identities regardless of external tags. Reserved three hold function remains intact; server mapping/add/stale-cart/serialization defenses remain fail-closed. Existing account, affiliate and consent source files unchanged.
- Imagery/layout not redesigned. All 320 tracked public/media/font/CSS files are byte-identical to current main; all eleven supplement catalog records deep-equal baseline. Only neutral image/texture disclosure and zoom accessibility wording changed. ml/mL artwork case intentionally untouched.

## Verified locally (Node 22.23.2)

```sh
export PATH=/Users/edorfanini/.nvm/versions/node/v22.23.2/bin:$PATH
npm run build:vercel
npm run typecheck:next
node --import tsx --test tests/new-skincare-only.test.ts tests/invoice-content.test.ts tests/invoice-catalog.test.ts
node --test tests/reserved-skincare-commerce.test.mjs tests/cart-routes.test.mjs tests/merchandise.test.mjs tests/shopify.test.mjs
node node_modules/vitest/vitest.mjs run --config tests/ui/vitest.config.mjs tests/ui/invoice-discovery.test.ts tests/ui/invoice-content.test.ts tests/ui/new-skincare-media.test.ts tests/ui/product-storytelling.test.ts tests/ui/purchase-options.test.ts tests/ui/supplement-product-story.test.ts --maxWorkers=1 --minWorkers=1
RELEASE_MATRIX_PORT=3220 node --test --test-concurrency=1 tests/e2e/new-skincare-release.e2e.mjs
```

Build/types pass; scoped lint has zero errors (eight existing-style warnings).
Content/catalog/preservation 13/13; commerce 107/107; focused UI 62/62; SEO/consent/bundle 55/55.
Real Next synthetic route matrix passes live/empty/outage/unconfigured/preview: 40 PDP cases plus aliases, exact-eight collection, sitemap, reference URLs and ordinary supplement controls. All cart mutations are synthetic fixtures only.
Normal CloakBrowser, no image substitution: 24 product/viewport cases at 320/390/1440, 96 opened formula/use panels, 96 gallery zooms; all images decoded, no page errors or page/text horizontal clipping. Exact-eight selectors, collection search/global search and both legacy routes checked. Read-only browser blocks all non-GET requests; none attempted. Local normal-image preview was unconfigured commerce, not live Shopify qualification.

## Baseline-aware limitations

Full UI: 160 passed, 3 failures plus one collection failure due to missing sibling `iqon-health-rate-settings`. All reproduced on pristine current-main baseline: bag-recommendation consent ordering and two original-relay status expectations. No unrelated fixes.
Full Node suite: 121 passed, 6 residual failures, all reproduced on current main: stale generic education/review expectations, retained vinext `dist` prerequisite, and stale CSS/review expectations. Affected count and comparison assertions were updated; the unrelated residuals were not waived as green.

Full evidence, all 104 audit-field closures, screenshots, RED results and exact test outputs:
`~/.hermes/runtime/iqon-skincare-catalog-refresh/invoice-corrections/builder/`.

## Release gates / rollback

Parent starts two independent reviews of the exact commit; at most two bounded correction cycles. No deployment yet. No DB migration or external catalog mutation. Rollback is reverting this isolated change, not resetting newer account/affiliate work. Use a parent-owned local review server after the builder stops its own PID; ports 3182/3183 remain untouched. Production read-only verification and actual Shopify catalog qualification remain parent release gates.

## Supplier confirmation draft (NOT SENT)

Please confirm the batch/lot-specific full INCI and final container/back-label photographs for each of the eight S8939 products against the IQON artwork approved October 16. In particular: Hyaluronic Serum's ingredient order and botanical naming differ from the current website; Firming Peptide Eye Gel's approved p2 formula differs materially from the website (peptide order, Vinca Minor, Cassia Angustifolia and preservative set); Copper's approved name is Copper Tripeptide-1 rather than the website's Copper Peptide-1. Please identify the document governing the supplied batches and any approved amendments. Confirm any concentration claims separately before publication. Invoice quantity/payment is not confirmation of available retail inventory. No retail price or stock was inferred.
