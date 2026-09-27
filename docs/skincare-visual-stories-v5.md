# IQON skincare: visual product stories

Reference review: September 27, 2026.

The previous iteration improved structure but relied on text and schematic cards.
This revision adds original visual content to every skincare product’s lower page.
The approved purchase gallery and pricing panel are preserved.

## Direct reference inspection

- https://www.timeline.com/skincare/products/firming-serum
- https://www.timeline.com/skincare/products/dewy-cream

Live screenshots and rendered DOM were examined for the evidence section, ingredient
section, media carousel, routine table, and FAQ order. At the desktop viewport,
Timeline pairs roughly 527 px skin imagery with compact evidence blocks, uses a
roughly 556 px ingredient visual beside ingredient rows, and shows product photography
in the routine table. The key lesson is the variety and usefulness of the content,
not simply its spacing.

| Observed reference feature | IQON implementation |
| --- | --- |
| Skin imagery beside product-specific claims | Original application photography beside supplied formula benefits |
| Clinical figures and before/after sliders | Label- and direction-based facts only; no invented trials or outcome imagery |
| Large visual beside complementary ingredient rows | New product editorial plus visible ingredient explanations |
| Different media across the page | Two distinct new images per skincare product; none reused from the approved gallery |
| Photographed routine/product table | Product images, focus, timing, ingredients and live prices in one comparison |
| Clear application and common questions | Product-specific steps, relevant care notes, working FAQ accordions |

## Creative production

14 original images were generated with the built-in image tool using structured JSON
prompts. Seven product photographs use the approved pack shot as the packaging
reference. Seven fictional-adult application photographs illustrate routine moments.
They are not testimonials, clinical results, or before/after evidence.

- Assets: `public/images/pdp-stories-v5/`
- Complete prompt set and source manifest: `creative/pdp-stories-v5/prompts.json`
- Rendering: `app/skincare-product-story.tsx`
- Content: `lib/skincare-stories.ts`

The images use cool grey, silver, charcoal, controlled light, natural skin detail,
and product-appropriate application. No decorative food or unsupported certification
badges are added. Product label wording and proportions were checked visually.
WebP encoding is used for delivery; the original generation files are preserved.

## Content provenance

Formula, ingredient and application statements use the supplied catalog and official
supplier checks documented in `docs/product-story-research.md`. No new numeric
efficacy claims, ingredient concentrations, treatment timelines, customer quotations,
or certifications were created. Copper cream retains the supplied formula warning
about retinol. The comparison explicitly explains that all products need not be layered.

The seven skincare pages receive this dedicated photographic design. The supplement
pages retain their separate ingredient-research content and existing layout.
