# New-products-only local candidate

State: **PR-ready / local preview candidate**, not approved to publish.

Adds only Enzyme Gel Cleanser, Hyaluronic Serum, and Peptide Anti-Wrinkle Day Cream. The existing seven skincare products—including Anti-Aging Cleanser with Peptides and Hydrating Tonic—remain unchanged. No retirements, replacements, redirects, price approvals, inventory claims, Shopify helper/plan or external writes are part of this patch.

## Preservation boundary
- Original catalog and all original product JSON, editorial maps, photography, CSS, global navigation, accounts, affiliates, checkout/payment/privacy and API files remain unchanged.
- New products live in separate `lib/new-skincare*` modules, not the shared catalog. Only `/collections/skincare` in **preview mode** appends their cards; existing PDP switchers and related grids keep their exact original data.
- Existing UI components resolve new-ID-only content fallbacks. The store shell has only an import and exact-new-route preview department fallback, so these new pages correctly select Skincare without changing any existing route/navigation behavior; a strict source-transform test protects the rest of that file. This deliberately reuses the current gallery, formula infographics, benefits, interactive ingredient spotlight, routine, compare and FAQ structure rather than creating a new design.
- New pages are available only with the existing unconfigured `mode=preview` catalog. Live/unavailable modes cannot discover the new candidates. SEO remains noindex, with no Product/Offer JSON-LD.

## Prices and availability
`retailPrice` is explicitly `null`; no stock is recorded. The existing `Product` interface needs a numeric price, so the adapter supplies a zero sentinel behind mandatory `pricePending=true`, `available=false`, empty variants and the existing skincare launch hold. Tests prove it is never displayed as a free offer or accepted into a cart. This is not launch authorization.

## Approved source facts
Source index: `source-facts.json`. Approved artwork is the October 16 complete-set approval of `IQON-SO8939-Proofs.pdf`, SHA256 `903cc271e6d8923cba303e338863d5c3e39714b8f110086855f65a1589d77395`.
- Enzyme: proof p8, distinct from the existing peptide cleanser; no peptide/panthenol transfer or replacement statement.
- Hyaluronic: proof p5 exact INCI, not a mixture with the supplier website list. Preservative/color additives remain disclosed; market/batch review is still required.
- Day cream: proof p7 visible directions include face, neck, décolleté and morning SPF. No stale PDF text-layer, nighttime balm, spatula/steam/post-procedure directions, invented signal peptide or sunscreen protection claim.

## Local media integration; publication hold
Three parent-accepted 4:5 packshot WebPs are integrated for **local preview only**, verified against `creative/page-assets/MANIFEST.json`. Visible gallery copy identifies them as packaging visualizations, not supplier photographs. This is not owner publication approval.

Three existing own-brand abstract closeups are referenced in place without altering their files: cleanser foam from `product-details`, serum/dropper from Hydra material artwork, and cream/spatula from Copper material artwork. Each carries the ordinary visible caption **“Illustrative texture study, not the finished formula”** and descriptive alt text. They do not establish finished-formula color, viscosity, application method or efficacy; no old-formula copy is reused. The old cleanser material photograph containing a hand was rejected in favor of the generic foam closeup. Exact paths, hashes and pixel-inspection findings are recorded in `media-integration.json`.

Three parent-accepted `editorial-light-final` WebPs now occupy the gallery and routine modules, byte-matched to their source manifest. Descriptive alt text identifies CGI packaging beside an empty glass cylinder, not the finished formula. All six rejected generated supporting images remain excluded. Unused SVG placeholders remain on disk, but no new page renders them. No existing photography or product page was replaced; no before/after results or fabricated reviews were added. Source release-hold metadata is retained: this acceptance permits local insertion, not publication.

## Local verification
Node 22 required. `npm ci --ignore-scripts`; `npx prisma generate`; `npm run build:vercel`.
- `node --import tsx --test tests/new-skincare-only.test.ts`
- `npx vitest run --config tests/ui/vitest.config.mjs tests/ui/new-skincare-media.test.ts tests/ui/product-storytelling.test.ts`
- `npx tsc -p tsconfig.next.json --noEmit`

External task evidence (not shipped in this repository): `/Users/edorfanini/.hermes/runtime/iqon-skincare-catalog-refresh/new-products-only/site/` (original candidate), `../integration1/` (packshot/texture integration), and `../integration2/` (final local editorial integration). Integration 2 contains build/focused-test receipts, real-browser 320/390/1440px new-page checks including all gallery panels and zoom, strict software-raster comparisons for the original seven at 390/1440px, source/asset preservation, screenshots and contact sheets. Earlier evidence remains frozen.

## Remaining gates
Two independent final exact-commit reviews owned by parent (max two bounded correction rounds), then owner preview approval. No PR push, merge, deployment or publication is authorized by this task. Eventual live activation is a separate explicit change; preview-only gating must not be silently removed.
