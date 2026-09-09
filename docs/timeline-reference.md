# Timeline reference and IQON implementation — 9 September 2026

## Pages inspected

- https://www.timeline.com/ — both hero slides, product selection, research sections and customer proof.
- https://www.timeline.com/products/mitopure-softgels-vegan — gallery, purchase options, ingredient accordion, comparisons, studies, timeline, certifications, reviews, FAQs and related products.
- https://www.timeline.com/skincare/shop — skincare assortment and routine navigation.
- https://www.timeline.com/skincare/products/firming-serum — gallery, product summary, ingredient sections, before/after evidence, comparisons, routine table, reviews and FAQs.

The visual inspection included live screenshots and computed typography/control styles, not only page text.

## Observed design values

At the inspected desktop viewport, Timeline's supplement hero uses **Suisse Intl**, weight **450**, approximately **62 px**, **1.05** line height and **-0.025em** letter spacing. The skincare hero and product heading are approximately **45 px**, in the same sans-serif family. The homepage Shop now button has a **4 px radius**, **12 px 20 px padding**, a **46 px height**, and **12 px uppercase type**.

IQON now uses this heading treatment and restrained button radius, with IQON's existing colors and original logo artwork. Hero and product image assets were not changed. The 9% product-photo inset remains.

**Exact font asset pending:** Suisse Intl is not present in the supplied project files. The heading stack is `Suisse Intl, Helvetica Neue, Helvetica, Arial, sans-serif`; it currently uses a system fallback. No font binary was copied from Timeline, and a fallback must not be represented as the exact Suisse font. Install the properly licensed WOFF2 files using local `@font-face` rules once supplied, then verify rendering. Official font and licensing information: https://www.swisstypefaces.com/fonts/suisse/ and https://www.swisstypefaces.com/licensing/.

## Product-page changes

All 11 preview supplements and all 3 existing skincare concepts now have individually authored summaries, highlights, a closer-look section, product facts and three product-specific questions. Supplement pages compare product identity, format and pack size. Skincare pages compare the cleanse/treat/moisturize steps. Existing gallery enlargement, variants, quantity controls, cart logic and live Shopify records remain authoritative.

The content is in `lib/product-content.ts`; presentation is in `app/product-story.tsx`. Editorial sections are limited to preview mode so they cannot silently add speculative claims to live Shopify products. No new skincare products from separate artwork projects are introduced.

## Content still required before commercial launch

Only product identity, pack format, net weight/count and explicitly identified flavors/sourcing are established in this preview. The following source material is still needed to replace the remaining prelaunch notices with final commercial content:

- Approved Supplement Facts / INCI ingredient panels and allergen information for each SKU.
- Approved serving or application directions, storage guidance and suitability information.
- Substantiation for any efficacy, clinical, sourcing, purity, testing, certification or manufacturing claim.
- Actual product reviews or customer content with permission to publish.
- Final prices, stock, shipping and return terms from the connected store.

Timeline's statistics, customer reviews, before/after results and certifications are references for information architecture only. They are not IQON evidence. No numerical results, reviews, directions, doses, medical benefits or certifications were manufactured to fill sections.
