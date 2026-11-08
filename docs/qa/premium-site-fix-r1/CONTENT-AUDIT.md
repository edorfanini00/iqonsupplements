# Correction-round content audit

Compared all eleven supplement records in verified-label-data.json against active product-copy.json/product-content, supplement-visual-content, supplement-details, product-gallery-content and legacy product-presentation, product-visuals, product-story-detail. Searched broader lib/app for missing amount, serving and CFU claims; preserved generic unknown-product fallbacks and label-reading education.

Corrected contradictions:
- GLP-1 active ingredient selection summary previously denied a CFU count while its expanded detail/fact strip correctly reported 6 billion. Summary now states separately printed 166 mg and 6 billion CFU; timing of viability remains unspecified.
- GLP-1 legacy presentation focus denied viable count. Corrected; legacy product-visuals probiotic explanation now explicitly names both printed measurements. Current gallery's selected-amount graphic never denied CFU and is unchanged. Legacy product-presentation is not claimed to be the current gallery renderer.
- Liver Support legacy presentation said no ingredient doses were stated and described artichoke without its recovered 50 mg amount. Corrected dose statement and both legacy artichoke explanations (50 mg extract, standardized to 5% cynarin).
- Gummies active expanded nutrient detail and legacy presentation said individual nutrient amounts were not supplied. Both now acknowledge the printed amounts per two-gummy serving and the formula table.

Preserved honest limits:
- Keto-5: total blend 650 mg is known; individual blend component weights and total caffeine remain undisclosed. Printed composition percentages do not establish component weights.
- GLP-1: 166 mg and 6 billion CFU are separate printed facts, never a mass-to-CFU conversion. Neither manufacture nor expiry timing is stated. Individual proprietary-blend component masses remain undisclosed.
- Gut Health: 10 mg probiotic and 1 billion CFU at manufacture; manufacture qualifier retained.
- Colostrum: IgG is within the total amount; not an added dose. Resveratrol: 600 mg is the complex, not pure trans-resveratrol.
- Pack mass, serving count and duration remain distinct. No serving calculations were changed, and unknown/alternate packs keep their existing guards.

All recovered nutrition data is unchanged byte-for-byte. Fifteen new component tests cover all eleven complete tables, fallback/no-amount states, live GLP ingredient selection, legacy contradictions and Gummies copy. Browser tests check all printed values in both live formula locations and explicitly synthetic fallback renders with the production component/CSS. On compact mobile explorers the existing selector summary is hidden; its DOM copy is checked, while expanded detail remains visible. Desktop checks assert the summary is visible. No mobile explorer or skincare renderer was redesigned.
