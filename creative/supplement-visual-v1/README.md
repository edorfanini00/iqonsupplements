# IQON supplement product stories — September 29, 2026

Applies the approved skincare editorial system to all 11 supplement product pages. The purchase gallery and commerce components are unchanged.

- Eleven separate, text-free editorial format images in `public/images/supplement-materials-v1/`.
- Product-specific benefits, ingredient spotlights, exact composition where disclosed, three-step directions and photographed comparisons.
- One-, two- and three-ingredient layouts; single-ingredient powders do not gain invented ingredients to fill a template.
- Six PubChem-sourced molecular structures and 15 explicitly labelled conceptual illustrations. Sources and rendering scripts are included here.
- Ingredient amounts, allergen statements, complete directions and cautions remain sourced from `lib/supplement-details.ts`. Research text retains its existing primary-source links and scope.
- Colostrum IgG is included within the serving; resveratrol percentage refers to the complex. No unlisted creatine scoop mass or probiotic CFU count is inferred.

Validation: Next.js typecheck and production build passed. Twenty-seven UI tests passed across supplement stories, skincare ingredient exploration and purchase galleries. All eleven WebP assets were decoded and checked at 1122 × 1402 px. Artwork and photographs were inspected directly. Browser-based desktop/mobile page review remains pending because browser automatic approval blocked origin access in this session.
