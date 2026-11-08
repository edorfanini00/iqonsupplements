# Original group 5 — purpose/focus browsing reconciliation

Implemented the original approved collection capability omitted from the compressed build brief. This is separate from the reviewed defect corrections preserved at `d45146950c456fb0f5f29ee85eded20659428d8e`. Same draft PR41; parent must obtain two independent reviews of the final new head. No merge or manual deployment action.

## Consumer behavior and rationale

Supplements alone expose a quiet **Browse by focus** row with All and three explicit groups. Membership lives in `lib/collection-focus.ts`, not marketing-keyword matching or availability rules:

- **Training:** Creatine Monohydrate. Existing product copy positions it for repeated, high-intensity effort.
- **Everyday nutrition:** Hydrolyzed Collagen Peptides, Grass-Fed Collagen Peptides (Chocolate), Hair, Skin & Nails Gummies. Existing labels identify collagen/protein powders and a vitamin/mineral gummy formula.
- **Digestive support:** Gut Health. Existing facts identify prebiotic fiber, a probiotic and digestive enzymes.

Unmatched supplements (including NMN, Keto-5, GLP-1 Support, Liver Support, Resveratrol and Colostrum) remain in All; no speculative longevity, disease or drug-equivalence categories were added. A product can be explicitly listed in more than one group if later approved. Skincare and all-products collections ignore the supplement focus parameter and retain their original search hint and local search-reset behavior. Focus does not filter by stock, change offer eligibility or claim available-only inventory. Known unavailable products remain discoverable with their existing unavailable label and View product action.

Focus combines by intersection with format and live local search; existing featured/name/price sorts still apply. Focus and format links preserve each other and sort; selected links expose `aria-current`, and result counts are announced by the existing live region. **All** clears focus only. **Reset filters** and the empty-state **Show all products** clear focus, format and local search while retaining sort. **Clear product search** clears just search. Empty intersections show a clear no-results message rather than suggesting the collection is coming soon.

Focus, format and sort use existing Next navigation/history and survive direct URLs, Back, Forward and reload. Search remains immediate local state as before: it persists while changing these filters, but is not newly serialized into URLs or restored after reload. Unknown/repeated focus values fall back to All. Canonical and robots policy is unchanged: query variants canonicalize to the clean collection URL; indexability still depends on the existing host/catalog policy.

The original format/guide row is retained. New focus links use understated text selection rather than another hero or panel. Reset is inline to keep the controls compact. Scoped CSS does not alter product pages, native consent, financial UI or skincare.

[Mobile Training](screenshots/training-390-viewport.png), [desktop Everyday nutrition](screenshots/nutrition-1440-viewport.png), [320px empty intersection](screenshots/empty-320.png), [actual 200% focus text](screenshots/focus-text-200-390-viewport.png).

## Final checks

Node22. Next production build, worker production build, separate TypeScript check and changed-source ESLint **PASS**. The existing direct `vinext build` fallback is used for the Mac GNU-timeout wrapper limitation.

- Focus component tests: **9/9**. Explicit membership, all/unmatched products, no keyword inference, skincare exclusion even with a matching ID, availability independence, combined format/search, empty/reset, URL composition, selected state, unknown focus, empty/unavailable data.
- Targeted production browser/SEO/layout suite: **39/39**. All focus groups at **320/390/1440**, actual counts, keyboard selection, selected state, format/search combinations, empty/reset, name/price ordering, Back/Forward/reload, unavailable products and original real image delivery. Focus controls have no overlapping boxes; the grid follows the controls; no page overflow; computed focus text is actually doubled at 200%.
- SEO coverage within that suite: **25 HTTP responses** (five query shapes × canonical live host / alias live host / preview / empty upstream / outage). Clean www canonical and existing index/noindex policy verified. Query shapes include combined format/focus/sort, unknown focus and repeated focus.
- Preview/empty/outage states covered. A successful empty Shopify response intentionally retains eleven unavailable editorial supplements under the existing merchandise merge policy; focus does not change that behavior. An outage shows the existing back-shortly state. The component separately covers a truly empty collection.
- Protected layout smoke at **390/1440**: Colostrum retains 16px size-to-description gap, 16px mobile/17px desktop body type and gallery-first DOM order. Frozen skincare slider interior pixels match the original baseline and ArrowRight/Home/End still work. The original bottom boundary pixel-row exception is unchanged; mobile baseline uses its original 390×844 viewport.
- Buyer-path and skincare source preservation tests: **20/20**, including all thirteen frozen file hashes and mount assertion.

The fixture extends the existing synthetic catalog hook and real loopback asset delivery. It restricts the upstream fixture to known catalog products (excluding generic/redirect fixtures with nonexistent placeholder CDN images), marks synthetic Gut Health unavailable, and leaves production eligibility rules untouched. It sends no real commerce, email or tracking mutations. Screenshots load original assets normally; no screenshot image replacement or hidden page chrome.

Final evidence is `collection-scope-qa/browser-complete/`; logs `build-complete.log`, `worker-build-complete.log`, `types-complete.log`, `lint-complete.log`, `component-complete.log`, `browser-complete.log`, and `buyer-paths-freeze.log`.

Diagnostic attempts remain separate: initial browser attempt was aborted after a generic fixture placeholder image timeout and URL-navigation wait race; waits and fixture assets were corrected. The second attempt passed36/37; its sole failed expectation incorrectly assumed an empty upstream removed editorial products. The next attempt passed38/39; mobile slider capture used 900px height instead of the baseline844px and included sticky-header overlap in its top127px (remaining pixels and desktop matched). With the original viewport, final39/39 pass. No production slider adjustment was made to satisfy the comparison. A final scope audit then restricted the new empty-state hint and URL reset to supplements; added all-products/skincare search/reset assertions pass in the final39/39 run.

## Preservation and handoff

Only two existing application files change: `app/collection-page.tsx` and `app/collections/[category]/page.tsx`. New application files are `lib/collection-focus.ts` and `app/collection-focus.css`. New component/browser/fixture tests and this separate QA record accompany them.

All **721 other prior application files** match the tested d451469 source manifest, including every table/CFU/spacing correction, native Google/privacy/consent and checkout/cart code, recovered label data, public assets and dependencies. All **2,523 prior evidence files** are preserved, including immutable FIX-R1-RESULT and its frozen evidence. The existing all18 acceptance ledger and earlier reports were not rewritten. Earlier broad suite results are reused with their original provenance, not presented as new runs; no unrelated historical suites were repeated.

Owned ports3991 and4030–4033 are stopped, and all owned tests/builds completed. External `COLLECTION-SCOPE-RESULT.md` records the exact pushed head, draft/clean status and any automatic non-production Vercel preview from the authorized branch push. Production settings, orders and native consent behavior were not changed. Parent owns two exact-final-head independent re-reviews and any later authorized release. No hosted purchase/checkout or production continuity claims are made.

## Reproduction

Use Node22; generate local test certificates under ignored `work/` or supply `QA_ASSET_KEY`/`QA_ASSET_CERT`. The browser suite owns ports3991 and4030–4033 and shuts down its children.

```sh
npm run build:vercel
npm run typecheck:next
bash scripts/sites-env.sh -- node_modules/.bin/vinext build
node_modules/.bin/vitest run --config tests/ui/vitest.config.mjs tests/ui/collection-focus.test.ts
node --import tsx --test tests/seo/buyer-paths.test.ts tests/skincare-preservation.test.mjs
QA_ASSET_KEY=work/collection-scope-key.pem QA_ASSET_CERT=work/collection-scope-cert.pem E2E_SCREENSHOTS=/tmp/iqon-collection-focus node --test tests/e2e/collection-focus.e2e.mjs
```
