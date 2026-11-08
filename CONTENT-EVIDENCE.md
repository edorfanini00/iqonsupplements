## Second recovery update, 7 November 2026
All 11 current supplement panels are now recovered. Builder inspected all selected renders and incorporated verified serving counts, per-serving price calculations, panel amounts, missing collagen cautions and the gummies tilapia/coconut declaration. The prior unknown-quantity/badge observations below are superseded by `docs/qa/premium-site/LABEL-RECOVERY.md` and version hashes in `recovered-label-provenance.json`. No skincare labels, batch assays or clinical/manufacturing certificates were recovered. Original directions remain; unflavored collagen wording differs between supplier specification and label, recorded as a source variance, not silently erased.

# Recovered label update, 7 November 2026

This update supersedes the original audit's unknown scoop/count statements for two products only. The builder inspected the parent-recovered original PDF renders, not just front badges. Creatine: one scoop 5.6 g, 5,000 mg creatine monohydrate, 50 servings. Colostrum: one scoop 2.3 g, 30 servings, 2,300 mg bovine colostrum including 575 mg IgG, contains milk. File hashes and exact evidence paths are in `docs/qa/premium-site/recovered-label-provenance.json`. Creatine supply in days varies with loading and maintenance. These labels do not establish lot assays, manufacturing certification or finished-product clinical efficacy. Other label gaps below remain scoped historical findings.

Parent narrative correction: the home page introduces product uses and experience; research limitations remain in product research, FAQ and Approach. Existing material and preparation artwork is not customer or batch evidence. Documentary real-use photography remains a concrete external media dependency.

# Content and asset evidence audit

Audit date: 7 November 2026. Scope: read-only inspection of this repository; this document is the auditor's only write. Implementation and tests belong to the builder. Skincare sliders, their before/after labels, assets, disclosures, controls, accessibility and behavior are explicitly outside the change scope.

## Evidence hierarchy and limits

- `lib/supplement-details.ts` is the existing transcription of owner-supplied supplier screenshots dated 10 September 2026. `creative/supplement-source-notes.md` identifies each screenshot by timestamp. These are ingredient statements, not complete Supplement Facts panels. Preserve exact complete directions, storage, warnings and allergens. Do not invent missing Daily Values, ingredient quantities, scoop mass or servings per jar.
- `lib/skincare-range.json` contains the seven current skincare records, supplied sizes, selected ingredient summaries, directions and Global Beauty supplier URLs. It is not a full INCI archive or a finished-formula clinical dossier.
- `lib/product-copy.json`, `lib/product-visuals.ts`, `lib/product-art.ts`, `lib/product-gallery-content.ts` and `lib/supplement-visual-content.ts` are derivative presentation records, not independent substantiation.
- Live Shopify catalog and published Shopify policies remain authoritative for prices, availability, payments, shipping, returns and company contact information. September launch notes contain superseded prices, old concepts, and retired Colon Gentle Cleanse; they cannot override current commerce.
- No original label PDF, complete independent laboratory report, or manufacturing certificate was found in this repository. Gut Health source notes name an owner-provided COA and final label proof, but the actual documents are not checked into this tree. This is a repository evidence gap, not a claim that the owner has never supplied them.
- No IQON finished-product human trial was found. Ingredient studies are separate from formula trials and manufacturing tests. Affiliate peptide education and peptide COAs are not evidence for supplements or skincare.

## Existing assets and their provenance

The repository already contains assets for every current product. Do not ask for replacement images merely because their filenames are unfamiliar.

- `public/images/supplements/` has all eleven primary packs, selected alternate views and group scenes. `docs/supplement-images.md` maps their original names and describes the initial `IQON_supplement_images` folder, subsequent studio refinements, reversions and November Gut Health replacement.
- `creative/asset-provenance.md` and `creative/studio-v4-prompts.json` explicitly describe regenerated/refined pack imagery and generated coastal, skincare and other editorial imagery. These images are existing brand assets; they are not documentary evidence of a physical batch, customers, endorsements or measured results. Older provenance notes differ by revision: use the asset-specific notes when available.
- `public/images/product-editorial/<handle>.webp` covers all 18 current products. `public/images/supplement-materials-v1/<handle>.webp` covers all 11 supplements. The latter are generated format illustrations, with exact prompts under `creative/supplement-visual-v1/`; they do not establish real powder/capsule/gummy appearance or dose.
- `public/images/skincare/products/` contains the seven skincare packs. `public/images/pdp-stories-v5/` contains a story and use image for each. `public/images/pdp-materials-v6/` contains each product's material illustration. Prompts are retained in the corresponding `creative/` folders.
- `creative/unique-editorial-sept10.json` identifies generated collagen, Keto-5 and GLP-1 detail scenes. `creative/asset-provenance-v2.json` marks the old generic store packs as concept artwork; do not substitute old daily/mineral/omega complex concepts for current products.
- Gut Health assets have precise special provenance in `docs/supplement-images.md`: primary and rear-label views are local composites using the Liver Support bottle and final Gut Health proof. The editorial is a relabeled Liver Support scene. Its material image is a mirrored generic Keto-5 capsule image. No photograph of the actual Gut Health capsule was supplied in this tree. Retain composite status internally; do not describe these as new physical product photography.
- Direct visual inspection confirmed that `12_hero_creatine_scoop.webp` contains a rendered “5 g per serving” badge, while the supplier transcription does not verify scoop mass. The image must not be used to compute a serving count or cost per serving. The current `15_hero_gut_health_label.webp` visibly shows two capsules, 30 servings and the CFU-at-manufacture qualification; its artwork provenance is still composite.
- Existing preparation scenes can illustrate use now. The remaining acquisition need is physical-batch photography, complete readable labels and proven provenance, not another generic lifestyle campaign. No new generation is required for this implementation.

## Per-product evidence and acquisition checklist

For every supplement, archive the approved full label version, matching supplier SKU/formula revision, lot-specific identity/potency/microbial/heavy-metal test results with methods and limits, manufacturing facility identity, and any claimed certification scope/expiry before expanding quality claims. A country field of USA does not establish US ingredient origin. Dietary badges must not imply independently certified status.

### Creatine Monohydrate

Existing assets: `00_pack_creatine.webp`, `12_hero_creatine_scoop.webp` and its responsive variants, `product-editorial/creatine-monohydrate.webp`, `supplement-materials-v1/creatine-monohydrate.webp`. Known from transcription: one ingredient, unflavored, 281 g jar; loading and maintenance frequency are specified. Missing: authoritative scoop mass, servings per jar, full Facts panel and finished-product potency/purity testing. Obtain a readable actual jar rear label and photographed level scoop/preparation using that exact product. Resolve the rendered 5 g badge against final label artwork; do not derive 56 servings from jar mass.

### Hydrolyzed Collagen Peptides

Existing assets: `01_pack_collagen_no_flavor.webp`, `product-details/hydrolyzed-collagen-peptides.webp`, its editorial and material files. Known: 280 g, bovine hide collagen peptides, one level scoop in 8 to 10 oz chilled beverage. Missing: scoop mass, collagen/protein grams per serving, servings, complete nutrition panel and documented grass-fed source chain. Obtain actual powder/mixing photography and current source declaration. “Grass-fed” exists in supplied presentation notes but is not independently established by the ingredient statement.

### Collagen Peptides, Chocolate

Existing assets: `02_pack_collagen_chocolate.webp`, `13_hero_collagen_choc_scoop.webp`, `product-collagen-detail.webp`, its editorial and material files. Known: 378 g, bovine hydrolyzed collagen, cocoa, acacia, flavor, salt, xanthan, stevia and silica; two scoops in 8 to 10 oz beverage. Missing: two-scoop mass, protein/collagen grams, nutrition/sugar panel, servings and documented grass-fed sourcing. Obtain exact final label and physical preparation/texture image. Larger jar and flavor do not imply the same dose or trial preparation as unflavored collagen.

### Colostrum Powder

Existing assets: `03_pack_colostrum_powder.webp`, `16_hero_colostrum_open.webp` and responsive variants, product detail/editorial/material files. Known: 69 g, 2,300 mg bovine colostrum providing 575 mg IgG at 25%; one scoop with cold liquid, consume within ten minutes; milk-derived. Missing: confirmed total scoop mass and serving count, batch IgG assay, animal/source chain, collection and processing documentation. Obtain readable physical label and real cold preparation sequence. Do not add IgG on top of colostrum mass, promise general immune benefits, or borrow ARMRA sourcing/process claims.

### Gut Health

Existing assets: `04_pack_gut_health.webp`, `15_hero_gut_health_label.webp`, editorial/material files; all special provenance above. Known label transcription: 60 capsules, two daily, 30 servings, ACV 1,000 mg, inulin 200 mg, DigeZyme 100 mg, LA85 10 mg with 1 billion CFU at manufacture. Every prominent CFU claim needs that time qualification nearby. Missing in repository: final `IQON_Gut_Health_Label.pdf` and proof PNG, `Gut_Health_COA_1253-5040235_18022026`, facility certificate and accredited laboratory scope. Recover those existing owner materials first, then verify report SKU, lot, dates and analytes. Do not extend its owner-reported UL/cGMP/FDA-registration/ISO-lab assertions to other products or describe FDA registration as approval. Actual pack, rear label and capsule photographs remain absent. Do not claim CFU through expiry without stability evidence.

### Keto-5

Existing assets: `05_pack_keto5.webp`, `product-keto5-detail.webp`, product detail/editorial/material files; pair/group scenes also exist. Known: 60 vegetable capsules, one twice daily, five named blend ingredients including caffeine; 30 days at suggested use is arithmetic from count/directions. Missing: total blend amount, individual amounts and total caffeine per daily dose; full Facts panel and any efficacy evidence for the finished blend. Obtain actual capsules with matching pack and complete label. Do not claim ketosis, fat burning, weight loss or caffeine-free status.

### GLP-1 Support

Existing assets: `06_pack_glp1_support.webp`, `product-glp1-detail.webp`, product detail/editorial/material files and pair/group scenes. Known: 60 capsules, two daily, selected nutrient and blend amounts in the transcription. Missing: original complete Facts panel confirming amount basis and overlapping nutrients across named blends; probiotic CFU, strain/stability confirmation, actual final formula specification. Recover both supplier screenshots at 14:57:26 and 14:57:34. Preserve iron overdose warning. Never sum overlapping nutrient entries, convert 166 mg LactoSpore to CFU, imply prescription equivalence, appetite/weight-loss efficacy or medication compatibility. Obtain real capsule and readable label photography.

### Liver Support

Existing assets: `07_pack_liver_support.webp`, `11_hero_liver_capsules.webp`, product detail/editorial/material files. Known: 60 capsules, two daily, seven botanicals plus L-cysteine; artichoke extract standardized to 5% cynarin. Missing: individual amounts and full Facts panel; actual batch botanical identity/contaminant testing. Obtain current physical label and verify source identity for each botanical. Do not turn 5% cynarin into an undisclosed milligram dose or add detox, cleanse, liver treatment or liver-function results.

### NMN

Existing assets: `08_pack_nmn.webp`, `17_hero_nmn_hand.webp`, `nmn-detail.webp`, editorial/material files. Known: 30 capsules, one daily, 500 mg beta-NMN per serving; supplier transcription states 99.9% purity. Missing: batch-matched independent purity/identity report, complete label and stability documentation. Keep any existing purity statement explicitly supplier-stated; do not promote an independently verified purity badge. Obtain actual capsule and readable rear-label photo. NAD+ precursor biology does not establish lifespan, age reversal or a finished-product clinical outcome.

### Resveratrol

Existing assets: `09_pack_resveratrol.webp`, `18_hero_resveratrol_hardshadow.webp`, `resveratrol-detail.webp`, product detail/editorial/material files. Known: 60 capsules, one twice daily, Polygonum cuspidatum root complex listed at 600 mg with 50% trans-resveratrol. Missing: original Facts panel to establish exact per-serving basis, assay of standardization and relevant botanical contaminants. Do not label it 600 mg pure trans-resveratrol or infer a daily active dose. Obtain actual capsule/rear-label photography and supplier source declaration. Human studies have mixed population-specific findings, not proven longevity effects.

### Hair, Skin & Nails Gummies

Existing assets: `10_pack_hair_and_skin_gummies.webp`, `14_hero_gummies_falling.webp`, editorial/material files. Known: 60 gummies, two daily, passion fruit, sugars and piscine collagen; fish and facility cross-contact disclosures. Missing: complete vitamin/mineral/biotin amounts, sugar/calorie nutrition data, exact serving weight and batch test results. Obtain real gummy appearance/size and complete label. Do not imply vegan status, sugar-free format or guaranteed hair/nail growth. Nutrition evidence does not establish visible results in nondeficient users.

### All seven skincare previews

Every product has an existing primary pack plus product-editorial, story/use and material assets. The exact primary filenames are in `lib/skincare-range.json`; the cleanser uses `anti-aging-peptide-cleanser.webp`, while the other six match their handles. Missing for each: final complete INCI and label, batch-matched formula revision, manufacturing identity, applicable stability/microbial/safety documentation, source declarations for any highlighted proprietary ingredient, and evidence for any claimed clinical endpoint. Obtain physical texture/application and front/rear label photographs as needed without touching the preserved sliders.

- Anti-Aging Cleanser with Peptides: existing 207 mL and peptides/glycerin/panthenol summary. Acquire peptide identities and full INCI; avoid unverified sulfate-free or clinical anti-aging promises.
- Hydrating Tonic: existing 198 mL and aloe/glycerin/sodium PCA summary. Acquire full INCI, fragrance/alcohol information; no unverified fragrance-free claim.
- Exfoliating Pads: existing 50 pads, mandelic/lactic/salicylic acids. Acquire concentrations, pH and complete label frequency; preserve sun warning, do not invent daily use or acid percentages.
- Hydra C + Ferulic Serum: existing 30 mL, vitamin C/ferulic/sodium hyaluronate. Acquire vitamin C form/concentration and stability; no sunscreen equivalence or quantified photoprotection.
- Retinol Rx: existing 30 mL, encapsulated retinol/niacinamide/squalane. Acquire retinol concentration and complete directions; preserve pregnancy/breastfeeding and SPF warnings; name does not establish prescription status.
- Firming Peptide Eye Gel: existing 15 mL, peptides/aloe/cucumber water. Acquire peptide identities, full INCI and any eye-area tolerance evidence; no fabricated ophthalmologist testing.
- Copper Peptide Restore Cream: existing 50 mL, copper peptide/shea/hyaluronate; directions disclose retinol. Acquire final full formula and copper/retinol amounts. Historical notes report the supplier page was inaccessible. Do not describe it as a plain barrier cream, post-procedure care or add outcome percentages.

## Research scope and citation check

`docs/product-content-sources.md` records prior research, including access limitations. `lib/product-copy.json` contains the customer-facing citations. On this audit, PubMed returned a readable collagen abstract, NMN record, and Timmers resveratrol record; several other requests returned empty anti-bot pages or HTTP 429. They are not counted as freshly verified full papers. No new medical claims or new efficacy studies are introduced by this audit.

- Creatine: [Hultman 1996](https://pubmed.ncbi.nlm.nih.gov/8828669/), [ISSN 2017 position stand](https://link.springer.com/article/10.1186/s12970-017-0173-z), and [NIH exercise fact sheet](https://ods.od.nih.gov/factsheets/ExerciseAndAthleticPerformance-HealthProfessional/). Existing scope is muscle stores and repeated high intensity effort. The position stand and fact sheet are syntheses, not trials of IQON. Hultman was not freshly readable during this audit.
- Both collagen products: [Proksch 2014](https://pubmed.ncbi.nlm.nih.gov/23949208/). Readable abstract confirms 69 women aged 35 to 55, a specified hydrolysate, eight weeks, improved elasticity and nonsignificant moisture/evaporation findings. Neither IQON formula is identified as the tested preparation; no IQON result or timeline follows.
- Colostrum: [Marchbank 2011](https://pubmed.ncbi.nlm.nih.gov/21148400/). Prior source notes describe 12 volunteers and exercise-associated intestinal permeability. This citation does not support broad immunity, all-population digestive outcomes or IQON processing claims. Fresh access was blocked.
- NMN: [Yoshino 2021](https://pubmed.ncbi.nlm.nih.gov/33888596/). Human metabolic research in a specific prediabetic population; no lifespan or IQON trial. Record retrievable on retry.
- Resveratrol: [Timmers 2011](https://pubmed.ncbi.nlm.nih.gov/22055504/) and [Yoshino 2012](https://pubmed.ncbi.nlm.nih.gov/23102619/). Existing copy properly juxtaposes different populations and mixed metabolic findings. Timmers record retrievable; Yoshino returned an empty response. Do not select only the positive result or generalize to longevity.
- Gummies: [NIH biotin consumer fact sheet](https://ods.od.nih.gov/factsheets/Biotin-Consumer/), already in the content record. This is a government ingredient overview, not a clinical trial of gummies. No new dose or result asserted here.
- Gut Health, Keto-5, GLP-1 Support and Liver Support have no existing matched clinical study citation in the product content. Leave research limitations explicit and prioritize formula facts; do not fill the research layout with borrowed citations.

A readable research layout can use existing study/population, finding, relevance, limitation and source fields now. Clearly label syntheses and government fact sheets as such. Detailed trial dosage should never become label directions.

## Company facts, reviews and notification dependencies

`lib/reviews.ts` is empty by design and explicitly rejects peptide reviews, generated testimonials and illustrative ratings. Remove empty review marketing blocks; retain honest compact product review availability. No actual customer evidence supports numerical trust badges, bestsellers, review counts or customer success claims.

`lib/store-policies.ts` and `lib/store-policy-content.server.ts` fetch Shopify's published policies and contact information. The audited local source does not establish a named founder, legal entity, ownership history, staffed location, independent advisory team, accredited in-house laboratory or universal manufacturing standard. “Our approach” can truthfully describe the site's product information, disclosed ingredients, separate research, format choice and existing support routes. Do not manufacture a company origin story.

Acquisition checklist for company evidence:

1. Owner confirms legal trading entity, authorized business/contact address, and approved public identity text against the live contact policy.
2. Owner provides actual supplier/manufacturer identities and SKU relationships; obtain facility certificates with scope, dates and permission to publish.
3. Owner provides authentic lot-matched test reports; confirm named lab, accreditation scope, methods, analytes, units and acceptance limits.
4. Owner approves any founder/team biography from factual records and supplies permissioned portraits. Until then, omit it.
5. Genuine review collection and publication require customer permission and verified order association. No requests sent in this task.

Repository searches for restock, back in stock, notify me, newsletter, subscription and waitlist found no storefront product availability signup API, subscriber storage or delivery flow. Existing affiliate contact/admin email APIs and Shopify refund restocking are unrelated. Keep skincare coming soon with functional product exploration and real support destinations. A restock signup is externally blocked until a product-aware backend, explicit consent/storage policy, unsubscribe flow, delivery service and isolated tests exist. Do not connect a fake form or reuse affiliate messaging.

## Actionable boundary for this release

The builder can complete information hierarchy, distinct galleries using existing assets, honest availability, readable ingredient research, restrained review emptiness, meaningful navigation and exact commerce terms now. Physical-batch media, full label archives, manufacturing/test documentation, verified corporate narrative and restock delivery remain specific external evidence/access dependencies. This audit grants no approval to alter commerce, contact customers, replace skincare sliders, merge or deploy.
