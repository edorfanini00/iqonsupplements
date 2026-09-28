# IQON skincare — section architecture

September 28, 2026.

The previous layout repeated a tall photograph on the left and copy on the right. This revision changes the composition of the lower page while preserving IQON's palette, typography, approved galleries, packaging and supplied product information.

## Reference inspection

Live Timeline Firming Serum and Dewy Cream pages were reviewed through screenshots of the benefit/results section, formulation section, ingredient comparison and photographed routine table:

- https://www.timeline.com/skincare/products/firming-serum
- https://www.timeline.com/skincare/products/dewy-cream

The useful structural patterns are distinct section types, prominent headings, grouped facts, compact ingredient explanations, clear rules between entries, and product imagery tied to a decision or routine. Timeline's clinical numbers, review counts and before/after claims are not used by IQON.

## New page sequence

1. A centered product-specific introduction establishes the benefit story.
2. A contained charcoal panel groups known formula/use facts beside the material image. The image is part of the panel rather than a freestanding left column.
3. Three concise benefit columns complete the section across the page width.
4. A full-width ingredient index gives each ingredient a role, name and explanation on the same row. Formulation details remain available in an accordion.
5. Application steps appear beside the product editorial, with product-specific care notes. On mobile, the photograph becomes a compact product card above the steps.
6. A centered comparison section uses smaller package images so focus, timing and formula differences remain prominent.
7. FAQs form one aligned reading column next to their heading on desktop and stack on mobile.

The material and application assets from v6 remain in use. No new image generation, efficacy claims, testimonial content or ingredient concentrations were introduced.

## Files

- `app/skincare-product-story.tsx`
- `app/skincare-product-story.css`

Skincare-only scope. Supplement product pages, top purchase galleries and checkout behavior are preserved.
