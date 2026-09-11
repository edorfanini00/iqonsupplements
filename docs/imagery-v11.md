# IQON imagery correction — v11

Replaces the four synthetic skin comparison pairs with detailed, matched cosmetic illustrations. Each pair preserves visible pores, freckles and fine skin texture while showing changes in superficial dryness, redness, uneven tone or fine dehydration lines. Both panels receive the same crop; there is no post-generation smoothing or colour adjustment. The first viewer now fills its frame instead of displaying a small rounded patch.

The comparisons remain limited to development and Vercel previews with the existing illustrative caption. They are not customer photographs or measured IQON product results.

Replaces the handwashing news image and plain supplement bottle with reference-guided IQON Barrier Cream and NMN photography. Replaces the hand-water and towel cards with IQON Peptide Serum and Barrier Cream details, also used in the mutually exclusive public community layout. Existing brand materials, serif wordmark and packaging references are preserved.

All twelve web assets use versioned URLs. The exact generation prompts, references, output dimensions and hashes are in `creative/imagery-v11.json`. Generation used built-in imagegen; web preparation only crops the paired panels and converts to WebP. This supersedes the corresponding imagery in v10 and `creative/unique-editorial-sept10.json`.

Validation: inspected all generated assets, verified twelve distinct web images and their dimensions, passed the Vinext and Next.js production builds, and passed the existing slider accessibility and skincare preview-boundary checks. Browser layout testing was not performed for this image correction.
