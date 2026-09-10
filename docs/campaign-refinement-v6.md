# Campaign refinement — 10 September 2026

## Direction
Restore the full photographic supplement hero and IQON’s editorial character while retaining direct product browsing. Replace the homepage split image/copy sections with continuous photography and live text overlays. Reduce mobile card width and typography; keep clear shop-all actions.

## Reference evidence
Reviewed Timeline’s [home](https://www.timeline.com/), [skincare](https://www.timeline.com/skincare), [shop](https://www.timeline.com/shop), and [vegan softgels page](https://www.timeline.com/products/mitopure-softgels-vegan), plus the supplied desktop banner and five phone screenshots documented in timeline-mobile-v5.md. Live desktop DOM measurements on skincare: product cards 295.5px; product names 16.88px / 21.10px line height; descriptions 12.88px / 19.32px; section heading 35.40px / 38.94px. The supplied banner demonstrates natural photographic negative space with overlaid text, rather than a separate text panel.

Timeline’s live responsive CSS defines product-name sizing as clamp(16px, calc(15.65px + 0.09vw), 17px) and descriptions as clamp(12px, calc(11.65px + 0.09vw), 13px). Mobile values are inferred from those rules and compared with the supplied phone screenshots; the browser does not expose device emulation for a live Timeline phone viewport.

## Implemented
- Native Higgsfield coastal hero: 3840 × 2160 desktop and dedicated 2480 × 3312 mobile composition. Full-width photography replaces the flat side panel.
- Coordinated Higgsfield skincare campaign: 3168 × 1344 desktop and 1792 × 2400 mobile, with live text and CTA over the photograph.
- Native 3840 × 2160 skincare lifestyle extension for desktop; original portrait retained for phone.
- Serif lifestyle headlines restore the earlier editorial character. Shorter copy and varied section heights balance shopping and photography.
- Home product rail is 68vw on phone; names 17px and descriptions 13px, with visible next-product previews. Desktop names 18px and descriptions 14px. Shop-all remains an outlined full-width button on phone.
- Catalog returns to two columns on phone with 16px names and 13px descriptions. Direct product navigation remains in place.
- Product information uses a compact facts/accordion layout without duplicating the gallery in a split photographic block.
- Dedicated mobile banner width prevents aspect-ratio minimum sizes from overflowing a narrow viewport.

## Asset QA
The selected hero and skincare images were inspected at native resolution and in the page. New supplement still-life images were rejected because the generator altered small label text and weights. Existing supplement catalog photography remains. No reviews, clinical claims or endorsements were invented. Complete prompts and public reference URLs are in creative/campaign-v6-prompts.json.

## Browser QA
Actual local desktop and embedded responsive phone layouts were reviewed. Checked full hero, product rail, continuous lifestyle and skincare banners, narrow skincare hero, supplement catalog, and NMN details. At 375px content width: home cards measured 255px wide; final type is 17px/13px. At 345px content width: cards 234.6px; skincare, catalog and NMN scroll width equals viewport width, with no broken images. Fixed a 27px narrow-screen overflow in the campaign banner and shortened its heading to avoid a three-line wrap. Production validation is recorded below after completion.

## Production validation
- Next.js production build and managed Sites/Vinext build passed.
- All 12 existing tests passed.
- Worker-rendered smoke checks passed on 28 routes including all 14 products: HTTP 200, one h1 per page, and 40 referenced image paths present.
- Temporary browser-review harness removed before publishing; git diff whitespace check passed.
