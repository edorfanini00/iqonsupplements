# IQON redesign validation — 10 September 2026

## Delivered

- New shared campaign hero, matched dimensions for supplements and skincare, and a more spacious rhythm across homepages, collections and product pages.
- Regenerated all 14 primary product packshots in one studio treatment. Replaced NMN and Resveratrol detail imagery and removed their hard-shadow group image from active galleries.
- Three new human campaign photographs plus three recovered editorial photographs. These are imagery, not customer endorsements.
- Individual copy, product details, comparisons and FAQs for all 14 products. Six ingredient education blocks distinguish published ingredient research from IQON product evidence.
- Three journal guides with authoritative further-reading links; honest empty review sections, ready for genuine reviews.

## Verification

- `npm run build:vercel`: passed (Next.js production build and TypeScript).
- Sites build helper / Vinext production build: passed.
- Existing test suite: 12 passed, 0 failed.
- Production-render check: 27 routes passed, each with exactly one h1; all 14 product pages included; all 35 referenced image paths exist.
- All 22 delivered WebP image files checked against their Git blob hashes before the review branch was created.
- Desktop browser screenshots reviewed for the two department homes and product layout.
- Responsive iframe checks at outer widths 360, 390, 430 and 768 px. With classic scrollbars, content widths were 345, 375, 415 and 753 px. No page-level overflow remained in the checked home, collection, journal or product layouts. Wider comparison tables scroll within their own region.
- Navigation open/close, category switching, capsule filtering, matching/empty search, gallery selection/zoom, ingredient anchors and comparison layout checked in the browser.
- Matched mobile homepage hero height: 710 px. Sticky product navigation adjusted for the 125 px mobile header, and tablet navigation overflow corrected. Product controls and gallery close targets enlarged.
- A temporary responsive review page was removed before the final build.

## Scope and limits

These are browser viewport checks, not native-device or touch-emulation tests. The available browser exposed no device/viewport control. Timeline blocked the external iframe attempt, so its mobile rendering was not directly verified. The reference audit separately records observed desktop behavior and mobile recommendations. It covers the current 18 catalog-linked product pages and major site families; it does not claim every historical article, review, external destination or authenticated checkout was inspected.

Supplement orders remain unavailable, skincare sample prices remain identified as preview content, and no checkout, subscription, production deployment or access policy was changed. No genuine customer reviews were present to publish.
