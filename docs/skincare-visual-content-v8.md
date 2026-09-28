# IQON skincare visual chapters

September 28, 2026.

This revision follows the three supplied Timeline screenshots: a compact ingredient comparison, a visual formulation panel with complementary ingredient thumbnails, and a benefits block with clear visual hierarchy. Existing IQON typography, blue-gray surfaces, charcoal panels, fine rules and photography-card styling remain the design basis.

## What changed

- Benefits now pair the approved product-specific texture or application photograph with four concise, illustrated benefit points. The large generic pack-size facts panel is removed.
- The formula section is an interactive ingredient spotlight with illustrated selectors, short role descriptions and readable benefit tags. Selecting an ingredient changes both its artwork and its full explanation.
- On phones, ingredient selectors form a three-tile visual control above the spotlight; photographs sit before the benefit points.
- The application section uses the existing product editorial once, beside three short illustrated steps and product-specific timing. Complete directions and care notes remain available.
- Product comparison markup and its established styling are preserved, alongside the approved upper purchase galleries, prices and checkout behavior.

All seven skincare products have their own benefit copy, ingredient graphics, timing and application steps. The approved v5 product images and v6 material images each appear once in the lower story. No new portrait generation was needed.

## Ingredient artwork

Twelve molecular diagrams were drawn with RDKit from PubChem compound records. Source URLs, compound IDs, formulas and SMILES are recorded in `creative/skincare-visual-v8/ingredient-structures.json`. In a grouped ingredient entry, the diagram is explicitly named for the individual compound it depicts (for example, glycerin within the glycerin/hyaluronate entry).

Emollient, water-binding and botanical-family illustrations are conceptual role diagrams, labeled separately from molecular structures. They are not representations of clinical outcomes or exact finished-product compositions. No study percentages or before/after results were invented.

## Verification

- Next.js TypeScript check and Vercel preview build pass.
- Four existing product-gallery tests pass; two ingredient-explorer tests check changing artwork/content and coverage of all seven formulas.
- Desktop and responsive screenshots reviewed. Tablet photo overflow found during review and corrected; ingredient role labels enlarged; mobile controls reworked into visual tiles.
- The temporary responsive review page is removed before publication.

## Main files

- `app/skincare-product-story.tsx`
- `app/skincare-product-story.css`
- `app/skincare-ingredient-explorer.tsx`
- `app/skincare-visual-sections.tsx`
- `lib/skincare-visual-content.ts`
- `public/images/skincare-ingredients/`

The refined preview (`57cddc5`) was reviewed at 1348 px desktop and within 375 px / 900 px responsive frames. Phone and tablet document widths match their viewports. Mobile selection was checked against its visible selected state and updated ingredient heading. Copper Peptide and Retinol formula panels were visually reviewed. Molecular thumbnails use contain sizing so the complete structure stays in frame.

Review image: `skincare-visual-v8-review.jpg`.
