# IQON commerce revision — 10 September 2026

This revision follows the user's three desktop screenshots and five Timeline skincare phone screenshots. It supersedes the layout descriptions in the earlier redesign validation note; the earlier note records checks of the previous revision only.

## Changes

- Named products and thumbnails are available directly in the desktop Shop menu and phone menu. The format submenu is removed.
- A product-page browser lists every product in the current department. Previous/next links let shoppers move through the range without returning to the collection. Each product route already remounts its product component by slug, so gallery and purchase selections reset correctly on navigation.
- Both homepages use large image-led horizontal product cards. Phones show a 78vw card plus a glimpse of the next; each card has a large name, short descriptor, size/price and a full-width action. A wide outlined collection action follows the phone carousel; desktop uses a prominent dark action beside the heading.
- The awkward routine introduction and repeated format-guide sections are removed. Collection pages open with products, search and sorting; old format-filter URLs still work and offer a clear reset.
- Product pages put their title and large gallery first on phones, retain the short proposition and key facts, and collapse longer product/research/FAQ text. Visual comparison cards replace the wide comparison table.
- The coastal hero was regenerated with more defined faces, fabric and surroundings; a separate portrait composition serves phones. Skincare has new desktop and phone serum close-ups, also integrated into the serum product gallery.
- New imagery retains its native dimensions: coastal desktop 1536×1024, coastal phone 1024×1536, serum desktop 1536×1024 and serum phone 1122×1402. WebP quality 97 preserves detail without artificial upscaling. Prompts and provenance are in creative/campaign-v5-prompts.json.
- Card actions, body copy, menu names and supporting product details use larger readable type. There are no invented IQON reviews or clinical before/after results.

## Current verification

- Next.js/Vercel production build and TypeScript: passed.
- Vinext production build: passed.
- Existing tests: 12 passed, 0 failed.
- Production-render checks: 28 routes, including all 14 products and 3 journal articles; every route returned 200 with one h1. All 38 referenced image paths exist, including phone sources.
- Structural checks confirm the new collection browser, previous/next links, mobile image sources and collection actions render, and the removed routine introduction does not.
- Native image files were visually inspected before integration.
- Git diff whitespace validation: passed.

## Browser limitation

The supervised preview reported running, but the supported browser returned ERR_BLOCKED_BY_CLIENT for the prescribed preview address on both attempts. The preview troubleshooting guidance identifies this as a browser-access environment failure. No fresh rendered desktop/mobile screenshots or interaction checks could be completed for this revision. The earlier revision's successful browser checks do not validate these changed layouts. Device, swipe, focus and visual regression checks remain to be completed when preview access is available.

Timeline phone observations are based on the five supplied screenshots; live desktop and responsive-CSS observations are separately identified in docs/timeline-mobile-v5.md. No production merge, checkout policy or order availability was changed.
