# IQON purchase options

## Storefront behavior

Supplement product pages expose only recurring selling plans allocated to the selected Shopify variant. Prices, introductory periods, delivery labels and cart totals come from Shopify. The previous illustrative 15% frontend discount has been removed. Products without plans retain one-time purchase only.

The cart passes the chosen `sellingPlanId` to Shopify, validates that the plan belongs to the variant, and keeps one-time and subscription lines separate. Cart and checkout remain hosted by Shopify; this code does not collect payment details or run renewal charges.

## Merchant activation still required

As checked on 29 September 2026, the IQON store (`nr9zd0-t5.myshopify.com`) has Shopify Subscriptions installed (`subscriptions-remix`) but no selling-plan groups. Create the plans inside that application so it owns and processes recurring billing; creating unowned plans through another app is not a substitute for a billing service.

Attach approved delivery schedules and prices to all 11 active `iqon-supplements` products. Do not include archived legacy products or skincare. The frontend will discover allocated plans automatically. The Storefront token must have `unauthenticated_read_selling_plans` as well as the existing product/cart scopes.

Before activating, review plan cadence, price/discount, cancellation policy and the app's customer-management settings. Verify the plan and first/renewal amounts in Shopify checkout without placing an order. Payment and actual renewal processing have not been exercised by automated tests.

## Skincare launch hold

All seven current skincare products were set to DRAFT in Shopify. Approved editorial content keeps the products browsable even while they are unpublished. The shared `SKINCARE_COMING_SOON` policy controls card/PDP labels, disables purchase controls, rejects server-side adds and removes old skincare cart lines before checkout. Draft status also closes direct Shopify purchase paths.

At launch, publish the approved skincare products in Shopify and update the shared policy together. Restoring inventory alone does not remove the website hold.

## Reference

- https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/subscriptions
- https://shopify.dev/docs/api/storefront/2026-07/objects/SellingPlanAllocation
- https://shopify.dev/docs/api/storefront/2026-07/objects/SellingPlanAllocationPriceAdjustment

## Verification

- `node --test tests/shopify.test.mjs tests/cart-routes.test.mjs tests/merchandise.test.mjs`
- `npx vitest run --config tests/ui/vitest.config.mjs tests/ui/purchase-options.test.ts tests/ui/supplement-product-story.test.ts tests/ui/product-storytelling.test.ts tests/ui/skincare-ingredient-explorer.test.ts`
- `npm run typecheck:next`
- `npm run build:vercel`
