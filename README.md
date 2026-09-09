# IQON Supplements & Skincare Store

IQON’s supplements and skincare storefront, built with React, Vinext and TypeScript. Repository: https://github.com/edorfanini00/iqonsupplements. Private hosting identifiers are omitted from the public GitHub export.

## Shopify integration status

Shopify catalog, product variants, stock status, persistent cart operations and a secure checkout handoff are implemented. The merchant store has not been connected, and the original supplement assets have not yet been supplied through an accessible folder. No products, payment settings, shipping rules, taxes, or orders have been created in Shopify. See [the connection notes](docs/shopify-connection.md) for the remaining setup and supported scope.

The site reads real products when its Shopify connection is configured. Without it, the explicitly labelled design preview remains active. A configured store error shows an unavailable state; sample products are never substituted into live commerce.

## Store experience

- Homepage with direct shopping, featured collection tabs, skincare ritual merchandising, material detail and lifestyle content.
- Separate supplements, skincare and all-product collection routes, format filtering and price/name sorting.
- Product routes with gallery selection, image enlargement, product information, quantity controls, one-time and illustrative subscription choices, delivery frequency, related products and a sticky purchase bar.
- Search, accessible navigation, a shopping bag with quantity/removal/cross-sell behavior and browser persistence, and a checkout summary preview.
- Brand approach, help and missing-page views.

## Brand and reference work

The saved IQON visual and video directions were reread, including the original silver case, charcoal environment, ivory/sage labels and distinctive serif wordmark. Typography now uses editorial serif headings and a serif wordmark treatment, with restrained sans-serif supporting UI. The old oversized thin Inter headline was removed. Official logo vector and wordmark font files have not been supplied; the current typographic mark is an interim treatment.

The full Timeline supplement and skincare stores and product pages, Skye Tides homepage/catalog/GLOW page, Seed DS-01 page and Augustinus Bader product content were studied. See `creative/design-research.md`. Competitor claims, imagery, metrics, reviews and policies are not reused.

## Artwork

`public/images/store` contains six coordinated catalog packshots and three campaign photographs generated with Higgsfield, plus a real Blender material rendering. `creative` contains the editable Blender revision, runnable scene script and provenance. The ten optimized WebPs total approximately 661 KB.

## Provisional catalog / launch requirements

The referenced IQON supplement folder was not accessible. Names, quantities, packaging, USD prices and subscription options in `lib/catalog.ts` are explicitly labelled sample design data throughout the preview. None is an approved SKU or commercial offer. Skincare is a proposed collection.

The unconnected preview does not accept orders or create subscriptions. Once connected, the server loads approved Shopify products and hands checkout to Shopify. Payment, customer contact details, delivery, taxes and policies are handled there. The sample subscription choice is not offered in live commerce. Browser local storage holds only the preview bag; live cart identity uses an HttpOnly cookie.

## Development

Requires Node.js 22.x.

### Vercel

Import `edorfanini00/iqonsupplements` with the repository root as the project root. The checked-in `vercel.json` selects Next.js, runs `npm run build:vercel`, and uses the native `.next` output. Do not set the output directory to `dist`: that directory belongs to the separate Worker build and cannot provide Next.js server routes on Vercel.

```sh
npm ci
npm run dev:vercel
npm run build:vercel
npm run start:vercel
```

Set the Shopify values listed in `.env.example` as server-side Vercel environment variables when the store is ready to connect. No Shopify credentials are required to deploy the labelled design preview. Changing hosted environment variables requires a new deployment. The storefront and cart routes remain dynamic so product availability and each buyer’s bag are resolved at request time.

The native Next.js build checks `tsconfig.next.json`, which covers the application and its imported dependencies. Unused Cloudflare deployment/database tooling belongs to the separate Worker target. TypeScript validation remains enabled.

### Existing Worker / Sites target

The original local and private-hosting commands remain available:

```sh
npm ci
npm run dev
npm run build
```

`lib/shopify.server.ts` owns the server-side Shopify connection. `lib/shopify-operations.ts` contains validated Storefront operations. `app/store-shell.tsx` owns navigation, search and bag state. `app/shop-pages.tsx` contains collection and product layouts. `app/site.tsx` contains the homepage. `app/globals.css` contains the responsive theme.

## Verification

The native Next.js production build and its TypeScript checks pass, with `.next` output and all storefront/API routes present. The separate Worker build also remains available. Shopify’s supplied validator accepted all six catalog/cart operations. Seven focused tests passed for request security, product mapping, stock/currency handling, error privacy, and cart-secret protection. Live merchant-store and checkout verification remain pending authentication. Direct assertions passed for sample subscription pricing, line totals and invalid persisted-cart data. Checking the entire legacy Worker/tooling tree with the original root TypeScript configuration still requires its Cloudflare runtime declarations. The image assets were visually inspected and source-level shopping behavior was reviewed. The cloud browser previously blocked the local preview with ERR_BLOCKED_BY_CLIENT; no new visual/browser test is claimed for this hosting compatibility fix.
