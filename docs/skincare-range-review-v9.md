# Skincare range refinement

September 29, 2026.

The approved v8 component was already connected to all seven skincare formulas. This pass reviews the full range and completes the product-specific details, keeping the approved purchase galleries, comparison, photography, palette and section architecture.

## Individual chapters

| Product | Opening ingredient | Visual and content focus |
| --- | --- | --- |
| Copper Peptide Restore Cream | GHK-Cu | Multi-peptide care, shea butter, water binding and a richer finish; ivory cream and silver spatula photograph. |
| Retinol Rx | Retinol | Evening treatment, delivery system, texture, fine lines and moisture support; approved adult application detail. |
| Hydra C + Ferulic Serum | Ascorbic acid | Antioxidant pairing, hydration and layering before moisturizer; pipette and serum photograph. |
| Exfoliating Pads | Mandelic acid | AHA/BHA families, targeted use, 50-pad format and evening directions; fibrous pad material study. |
| Hydrating Tonic | Sodium PCA | Water-light hydration, humectants, aloe-based conditioning and the pre-serum step; water and glass photograph. |
| Firming Peptide Eye Gel | Palmitoyl tripeptide-1 | Cooling texture, targeted peptide care and hydration; translucent gel photograph. |
| Anti-Aging Cleanser with Peptides | Panthenol | Daily buildup, comfort, rinse-off peptide formula and thorough rinsing; approved fine-lather application photograph. |

Every formula has its own photo label and routine eyebrow. Timing icons now distinguish evening, morning/evening and the moisturizing step. The pads do not use a generic daily-routine label. Ingredient selectors use concise visible labels while preserving the full ingredient names in the detailed panel and accessible button labels. Ingredient state is keyed to the product when navigating between formulas.

No new ingredient claims, clinical figures or usage quantities were introduced. Copy comes from the existing supplier-grounded product content. The approved photographs already cover the required materials and formats, so no new generation was necessary.

## Quality review

- All seven products inspected in responsive frames at 375 and 900 px; content widths remain 360 and 885 px respectively after browser scrollbars.
- Long ingredient labels reviewed on Copper Peptide, Retinol and Eye Gel. Cleanser ingredient selection checked against the updated artwork and explanation.
- Serum benefit photograph and Pad application board reviewed on phone and tablet. Other benefit photography also inspected on desktop.
- Corrected a specificity conflict that removed the intended 25 px mobile gap between the introduction and benefit photograph.
- Storefront TypeScript passes. Thirteen focused tests pass, including selecting all three ingredient entries on each of seven formulas.
- Temporary responsive review page is removed from the production tree.
