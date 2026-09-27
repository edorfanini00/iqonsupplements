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
