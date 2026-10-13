# IQON purchase options

## Storefront behavior

Supplement product pages expose only recurring selling plans allocated to the selected Shopify variant. Prices, introductory periods, delivery labels and cart totals come from Shopify. Savings are calculated from the selected variant’s actual one time price and Shopify allocation. The subscription is selected by default when a plan exists, with one time purchase one tap away. Billing and delivery intervals come from Shopify policies, including nonmonthly and prepaid plans. Products without plans retain one-time purchase only.

The cart passes the chosen `sellingPlanId` to Shopify, validates that the plan belongs to the variant, and keeps one-time and subscription lines separate. Cart and checkout remain hosted by Shopify; this code does not collect payment details or run renewal charges.

## Merchant activation

On 13 October 2026, Shopify Subscriptions (`subscriptions-remix`) owns group `80931946791`, titled “Subscribe & save 15%”, with selling plan `693742764327`. Delivery and billing recur every month with 15% off every order. All 11 active supplements are included; one time purchase remains available. No production order was placed.

Keep approved delivery schedules and prices attached to all 11 active `iqon-supplements` products. Do not include archived legacy products or skincare. The frontend will discover allocated plans automatically. The Storefront token must have `unauthenticated_read_selling_plans` as well as the existing product/cart scopes.

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


## October 2026 release validation

Regression coverage includes default selection, exact $48.97 to $41.62 pricing, $7.35 savings, one time switching, missing plans, changing variants, introductory pricing and prepaid schedules. The local browser uses a sanitized catalog fixture and blocks mutations. Preview and production verification use the actual Shopify allocation and stop before payment. Independent review, browser evidence and operational results are in the task evidence directory `launch/subs` in `iqon-body-ads`.

Rollback the frontend by reverting this change; the real selling plan remains owned by Shopify Subscriptions and continues billing existing contracts. Do not delete a plan or cancel contracts as a code rollback. No database migration, payment-provider change or secret change is needed.
