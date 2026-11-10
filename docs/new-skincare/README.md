# Three approved skincare pages — publication candidate

State: **PR-ready**, not merged or deployed. Owner approved the three page visuals after exact-head reviews of `91af947aed8edfd43d772d292b0a3cad93770c2d`. This follow-up is the explicit publication delta; parent must obtain two independent reviews of the final release head before merging/deploying.

## Scope and public behavior
Adds only Enzyme Gel Cleanser, Hyaluronic Serum, and Peptide Anti-Wrinkle Day Cream as informational **Coming soon** pages. All seven existing skincare products—including Anti-Aging Cleanser with Peptides and Hydrating Tonic—remain unchanged. No retirements, replacements, redirects, price approvals, inventory claims or Shopify writes.

- `lib/new-skincare*` remains separate from the shared catalog. Only the skincare collection appends these three cards; old PDP switchers, related grids, global catalog/search and navigation lists remain unchanged.
- An exact three-ID allowlist resolves their pages in live, empty, unconfigured and unavailable catalog states. Unknown routes and all other pages retain their original behavior.
- These static informational records take precedence over a same-handle Shopify response for their own route/cards. An incidental catalog publication cannot turn them into offers.
- The existing Coming soon presentation remains: no displayed price, variants, buy control, stock claim, shipping promise or review samples. The disabled button says **Not available to order yet**.
- Their own canonical metadata and sitemap entries are indexable only on production `www.iqondaily.com`; alias hosts and preview deployments remain noindex. Only BreadcrumbList is emitted, never Product/Offer/review markup. Existing sitewide indexing rules are unchanged.
- Shopify remains the commerce source of truth for existing products. No environment/preview flags, checkout/account/affiliate/consent logic or Shopify helper was changed.

## Price and stock boundary
`retailPrice` stays `null`; no stock is recorded. The existing Product interface requires a numeric price, so a zero sentinel remains behind `pricePending=true`, `available=false`, and empty variants. Tests prove that it is never shown as a free offer or admitted as a new cart line. An invoice quantity ordered is not sellable inventory. Future order activation requires separately verified current price, stock, variant and compliance facts and an explicit reviewed change; this informational publication does not authorize it.

## Preservation and approved source facts
All original product JSON, editorial maps, assets, CSS, accounts, affiliates, payments/privacy and API files remain unchanged against current main `a4c4b12d8d29608adecfea48609a00db298b7ff7`. No newer main changes were dropped; it was the frozen candidate's exact ancestor and was re-fetched during release preparation.

Source index: `source-facts.json`. Approved artwork: October 16 complete-set approval of `IQON-SO8939-Proofs.pdf`, SHA256 `903cc271e6d8923cba303e338863d5c3e39714b8f110086855f65a1589d77395`.
- Enzyme: proof p8, distinct from the original peptide cleanser; no peptide/panthenol transfer or replacement claim.
- Hyaluronic: proof p5 exact INCI, not a mixture with supplier website copy. Preservative/color additives remain disclosed; market/batch review is still required before commerce activation.
- Day cream: proof p7 directions include face, neck, décolleté and morning SPF. No stale PDF text-layer, nighttime balm, spatula/steam/post-procedure directions, invented signal peptide or sunscreen protection claim.

## Media provenance (unchanged pixels)
All six approved packshot/editorial WebPs retain the frozen candidate hashes. No rerender/redesign. Packaging is visibly described as visualization, not supplier photography. Editorial alt text identifies the glass prop as empty, not formula.

Three existing abstract closeups remain referenced in place without file changes. The ordinary visible caption is **Illustrative texture study, not the finished formula**. These images do not establish the new formula's color, viscosity, application method or efficacy. Exact paths/hashes are in `media-integration.json`. The manifest's earlier local-only source-release holds are historical provenance and have not been rewritten; owner visual approval and this explicit frontend release candidate supersede only the site-publication hold after parent review. No authority to repurpose source files elsewhere is implied.

Unused SVG placeholders remain on disk but are not rendered. No fabricated before/after results or reviews were added. The inherited shared-gallery zoom focus-restoration P2 remains intentionally unchanged and out of scope.

## Reproduction
Node 22. `npm ci --ignore-scripts`; `npm run build:vercel`; `npm run typecheck:next`.
- `node --import tsx --test tests/new-skincare-only.test.ts tests/seo/seo.test.ts tests/seo/buyer-paths.test.ts tests/seo/store-policies.test.ts`
- `npx vitest run --config tests/ui/vitest.config.mjs tests/ui/new-skincare-media.test.ts tests/ui/product-storytelling.test.ts tests/ui/skincare-ingredient-explorer.test.ts tests/ui/purchase-options.test.ts tests/ui/purchase-clarity.test.ts`
- `node --test --test-concurrency=1 tests/e2e/new-skincare-release.e2e.mjs`

The route matrix starts owned servers on 3194–3198, using synthetic Shopify fixtures and zero external writes. Test modes: live, empty, unavailable, unconfigured production and preview; each also checks alias metadata. Keep these ports free, or set `RELEASE_MATRIX_PORT`. `RELEASE_EVIDENCE` optionally sets the receipt directory.

Broad UI/SEO/lint suites have independently reproduced current-main failures; see the runtime release report, not an assertion that the entire repository is green. Normal rendered-image QA is separate from mocked-catalog routing tests.

## Evidence and release gates
Runtime evidence: `/Users/edorfanini/.hermes/runtime/iqon-skincare-catalog-refresh/new-products-only/release/REPORT.md`. Original `site`, `integration1`, `integration2` and final-review-A/B evidence are preserved.

Parent owns two independent exact-final-head release-delta reviews, bounded correction (at most two rounds), PR/merge/deployment and live verification. Do not deploy this candidate directly or write Shopify records. No migration, tier change, purchase or credential change is required. Rollback is a reviewed revert of this additions-only release, preserving any newer unrelated work; never reset the whole site to the old baseline.
