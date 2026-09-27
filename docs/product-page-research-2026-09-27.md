# Product education refresh — 27 September 2026

## Reference pages reviewed

- Seed DS-01: https://seed.com/daily-synbiotic — clear benefits, ingredient depth, usage, FAQs and links to research.
- Timeline Mitopure: https://www.timeline.com/products/mitopure-softgels-vegan — a readable progression from the formula to the daily routine and scientific context.
- Ritual Synbiotic+: https://ritual.com/products/synbiotic-plus-for-gut-health — specific ingredient identities and transparent explanations.
- SkinCeuticals C E Ferulic: https://www.skinceuticals.com/skincare/vitamin-c-serums/c-e-ferulic-with-15-l-ascorbic-acid/S17.html — distinct benefits, application guidance and formulation details.

The implementation borrows information hierarchy, not competitor copy, claims or results. IQON retains its cool silver/charcoal palette, restrained typography and approved product photography.

## What changed

All 18 products now have tailored benefits, ingredient roles, step-by-step routines, practical FAQs and comparisons using current catalog prices. Ingredient research remains explicitly separate from evidence for a finished IQON product. No fabricated clinical results, reviews, subscriptions or stock were added.

The shared supplement component now actually displays the supplied full ingredient statement; previously it omitted that field. Existing label cautions, allergens and storage instructions are retained. These statements are not represented as complete Supplement Facts panels, because the source does not supply every Daily Value or serving amount.

## IQON data and verification

Primary product facts come from `lib/supplement-details.ts` (owner-supplied supplier specifications, 10 September 2026) and `lib/skincare-range.json`. Current supplier pages were checked for these formulas:

- https://supliful.com/catalog/glp-1-support-capsules
- https://supliful.com/catalog/nmn-capsules
- https://supliful.com/catalog/hair-skin-nails-gummies
- https://www.globalbeauty.net/product/anti-aging-cleanser-with-peptides/
- https://www.globalbeauty.net/product/hydrating-tonic/
- https://www.globalbeauty.net/product/exfoliating-pads/
- https://www.globalbeauty.net/product/hydra-c-plus-ferulic-serum/
- https://www.globalbeauty.net/product/retinol-rx/
- https://www.globalbeauty.net/product/firming-peptide-eye-gel/
- https://www.globalbeauty.net/product/copper-peptide-restore-cream/

Skincare lists key ingredients, not an unverified final IQON batch INCI. Supplier percentage claims were not added where the final IQON label is not confirmed. The copper peptide cream's retinol is disclosed in its FAQ and routine.

## Research boundaries

- Creatine: https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/ and https://pubmed.ncbi.nlm.nih.gov/8828669/
- Biotin: https://ods.od.nih.gov/factsheets/Biotin-Consumer/ — limited evidence for cosmetic benefits outside deficiency; laboratory-test interference is included in the FAQ.
- NMN: https://pubmed.ncbi.nlm.nih.gov/33888596/ — a particular human study, not evidence of lifespan extension or proof for the IQON bottle.
- Colostrum: https://pubmed.ncbi.nlm.nih.gov/21148400/ — specific exercise research, not a general immunity guarantee.

Existing collagen and resveratrol research links and their limitations remain separate from product promises. GLP-1 Support is not described as a GLP-1 drug or substitute. No new weight-loss promise is made for Keto-5 or Liver Support.

## Commerce

Shopify remains authoritative for price, currency, availability and variants. Product comparisons receive that same merged live catalog. Unavailable products remain unavailable. Actual customer reviews remain separate from design preview data.

## Second editorial and conversion pass

The next pass was checked against the same four current reference pages. The strongest transferable patterns are summarized below.

| Reference | Useful information pattern | IQON implementation |
| --- | --- | --- |
| Seed DS-01 | Benefits, ingredient specifics and supply information close to the buying decision | Compact, product-specific essentials beside purchase; full ingredient statements remain accessible |
| Timeline Mitopure | Clear daily use, an explanation of the ingredient, and expectations tied to its own evidence | A tailored fit guide for every product and separate ingredient-research sections; no borrowed clinical timelines |
| Ritual Synbiotic+ | Easy access to serving information, ingredient identity and substantiated traceability | Explicit contents and use; no certification badges without IQON documentation |
| SkinCeuticals C E Ferulic | Match a formula to a skin concern and explain its place in the routine | Skincare comparisons identify focus, timing and differentiating ingredients |

All 18 products have new `essentials`, `guide` and `comparison` copy. The guides explain suitability, the experience of use, and one material consideration such as source, caffeine, an allergen or another active in the formula. More detailed evidence limitations remain in the relevant FAQs and research sections.

Daily cost is shown only for NMN, Resveratrol, Liver Support, Keto-5, GLP-1 Support and Hair, Skin & Nails Gummies: their supplied bottle counts and directions establish 30 days of use. It uses current price and currency, not a stored dollar amount. It is suppressed for unknown supply, pending prices and multiple pack variants. No duration is inferred from an undisclosed scoop weight.

Comparison cards now include purpose, routine, key differences and contents. The viewed product is always first. Skincare treatments are compared with other treatment steps; cleansers, hydration and moisturizers show their distinct roles. A comparison is not an instruction to layer every product together.

The purchase header no longer renders an empty star rating when there are no customer reviews. Real reviews still appear automatically. Preview fixtures remain isolated. The outdated test that assumed every current SKU had a legacy design-review fixture was replaced with checks for empty live states, preview-only samples, and real-review precedence.

Validation: all 18 product stories render, navigation anchors resolve in the product-page context, full supplement information is retained, comparisons use live prices, daily-price edge cases are covered, and genuine review data takes precedence over previews. Production build and live visual review are required before completion.
