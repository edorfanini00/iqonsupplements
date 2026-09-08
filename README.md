# IQON Supplements & Skincare Store

A complete ecommerce design preview in React, Vinext and TypeScript. Intended GitHub repository: `iqon-supplements`. The private Site identity is retained in `.openai/hosting.json`.

## Store experience

- Homepage with direct shopping, featured collection tabs, skincare ritual merchandising, material detail and lifestyle content.
- Separate supplements, skincare and all-product collection routes, format filtering and price/name sorting.
- Six product routes with gallery selection, image enlargement, product information, quantity controls, one-time and illustrative subscription choices, delivery frequency, related products and a sticky purchase bar.
- Search, accessible navigation, a shopping bag with quantity/removal/cross-sell behavior and browser persistence, and a checkout summary preview.
- Brand approach, help and missing-page views.

## Brand and reference work

The saved IQON visual and video directions were reread, including the original silver case, charcoal environment, ivory/sage labels and distinctive serif wordmark. Typography now uses editorial serif headings and a serif wordmark treatment, with restrained sans-serif supporting UI. The old oversized thin Inter headline was removed. Official logo vector and wordmark font files have not been supplied; the current typographic mark is an interim treatment.

The full Timeline supplement and skincare stores and product pages, Skye Tides homepage/catalog/GLOW page, Seed DS-01 page and Augustinus Bader product content were studied. See `creative/design-research.md`. Competitor claims, imagery, metrics, reviews and policies are not reused.

## Artwork

`public/images/store` contains six coordinated catalog packshots and three campaign photographs generated with Higgsfield, plus a real Blender material rendering. `creative` contains the editable Blender revision, runnable scene script and provenance. The ten optimized WebPs total approximately 661 KB.

## Provisional catalog / launch requirements

The referenced IQON supplement folder was not accessible. Names, quantities, packaging, USD prices and subscription options in `lib/catalog.ts` are explicitly labelled sample design data throughout the preview. None is an approved SKU or commercial offer. Skincare is a proposed collection.

This site does not process payments, submit orders, create subscriptions, collect customer contact data, or claim clinical outcomes. Replace the sample catalog with approved product information, original artwork and evidence, then connect a commerce service and publish real policies before enabling sales. Browser local storage holds only the sample bag.

## Development

Requires the Node version supported by the retained starter.

```sh
npm ci
npm run dev
npm run build
```

`app/store-shell.tsx` owns navigation, search and bag state. `app/shop-pages.tsx` contains collection and product layouts. `app/site.tsx` contains the homepage. `app/globals.css` contains the responsive theme.

## Verification

The production build completed for the new route tree. Direct assertions passed for sample subscription pricing, line totals and invalid persisted-cart data. Standalone TypeScript checking reports missing Cloudflare runtime declarations in the retained starter (`cloudflare:workers`, `Fetcher`, `D1Database`); no new storefront type errors were reported. The image assets were visually inspected and source-level shopping behavior was reviewed. The cloud browser currently blocks the running local preview with ERR_BLOCKED_BY_CLIENT, so a fresh visual/browser interaction review and new screenshots could not be completed for this revision. This limitation is not represented as a passed browser test.
