# Skincare photography, results and reviews — 10 September 2026

## Requested structure
The skincare campaign is followed by a results comparison when approved results exist, the community/review strip, and paired photographic collection/routine cards. The pair replaces the previous “A moment that’s yours / A little care. Every day.” lifestyle section. It uses “The skincare collection,” “A few essentials.” and “A moment for you.” from the approved campaign. The three small introductory columns describe Cleanse, Treat and Moisturize, without borrowing Timeline’s scientific or sustainability claims.

The supplied Timeline screenshots are layout references only: square before/after viewer with thumbnail selection and a results column; a horizontally scrolling mixture of media and serif review cards; and two large photographic shopping/editorial links.

## Selected imagery
- New Higgsfield skin-application portrait, native 3712 × 4608, used on the routine card.
- New Higgsfield serum-in-hand photograph, native 1792 × 2400, used as brand editorial content in the community section.
- Existing approved IQON three-product campaign photograph reused on the collection card. The newly generated trio was rejected for packaging changes and invented small label text.
- Native dimensions preserved in WebP. Exact prompts and public source references are in creative/skincare-v7-prompts.json.

These generated photographs are brand editorial imagery. They are not customer review media or evidence of a treatment result.

## Content still required
No genuine IQON skincare before/after set or customer reviews were found in the repository. The targeted file search returned design references and artwork, not a usable IQON evidence set. The existing customerReviews array is empty.

The before/after module is built but renders nothing until approved results are supplied. The community section displays editorial images and a clear pending-review message; it does not display invented stars, quotes, customer names, verification badges or video play buttons.

To publish results, add records in lib/skincare-results.ts with the actual product ID, consented matched photographs, exact substantiated headline/measurements, timeframe, methodology and source link. Both publication approval and photography consent must be confirmed. No competitor claims, synthetic transformations or unsupported percentages belong in this dataset.

To publish reviews, add genuine permissioned review records in lib/reviews.ts. Set verifiedPurchase only when verified. Optional media supports an image or a playable video with poster and accessible description. The skincare carousel filters by actual skincare product IDs and links to /reviews?collection=skincare, which now filters the review listing.

## Verification
Actual desktop and 345px/375px content-width phone layouts were reviewed, with no body overflow or broken images. The paired collection image uses a less tall phone frame to keep all three packages in view. The skin portrait retains a full portrait frame on phone.

A temporary local QA route used explicitly labeled sample content to exercise the data-dependent layouts. The same editorial photo was placed on both sides of the comparison; no transformation was generated. Keyboard ArrowRight changed 50 to 51, End reached 100, and thumbnail selection reset the reveal to 50. Review navigation changed the horizontal scroll position. The comparison, review cards and thumbnails fit a 345px viewport. Slider accessibility was improved by forwarding the label to the actual interactive thumb. The QA route and responsive harness were removed before the production builds.

## Production checks
Both Next.js and managed Sites/Vinext production builds passed. All 13 tests passed, including the new slider-label regression. Worker-rendered checks passed for 29 routes, all 14 products and 42 referenced images. Skincare-only review filtering, absence of unpublished comparison/results/ratings, selected imagery and removal of the local QA route were checked.
