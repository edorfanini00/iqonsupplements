# IQON checkout readiness — 13 September 2026

## Completed in the website

- Shopify-backed cart creation, persistence, quantity updates and removal.
- One cart supports supplements and skincare together.
- Discount-code entry, Shopify validation and removal in the bag and review page.
- Direct secure checkout from the drawer and the full review page.
- Corrected cart snapshots are shown after inventory errors or an expired cart.
- A visible reconnect action when the initial cart request fails.
- Approved skincare photography in the shopping bag.
- Supplement facts, directions and product content remain visible in live mode.
- Launch verification now checks the current 18 products instead of the old 14-product concept manifest.

## Confirmed live blockers

Store: `nr9zd0-t5.myshopify.com`.

| Item | Observed state | Required next step |
| --- | --- | --- |
| 11 supplements | Draft; tracked inventory zero; overselling denied | Connect Supliful, map actual supplier variants and labels, then activate and publish |
| 7 skincare products | Draft; tracked inventory zero; overselling denied | Confirm available quantities and fulfillment location, then activate and publish |
| Supliful | Not present in installed-app query; every variant uses the manual Shop location | Merchant signs in and approves the supplier connection |
| Shipping | US shipping enabled; general profile has 3 active methods and no locations without rates | Verify rates for actual supplement/skincare fulfillment origins and a mixed basket |
| Payments | Merchant previously reported setup complete; wallet settings include Shop Pay, Apple Pay and Google Pay | Verify an actual hosted checkout once products are sellable; connector lacks payment-account status permission |

The live cart API returns HTTP 200 for an empty bag. Adding the serum returns HTTP 422 because the selected product is not available. This is a product/fulfillment configuration block, not a disconnected frontend button.

No quantities were invented, inventory safeguards disabled, supplier accounts charged, or orders placed. Archived concept skincare products remain archived.

## Verification

- Shopify schema validation passes for catalog and all cart operations, including discounts.
- 17 commerce tests pass, including the real route handlers exercised against a deterministic Shopify fixture: mixed basket, persistence, quantities, discounts, checkout URL, cart expiry, inventory rejection and mutation errors.
- Production Next.js build passes.
- Simulated integration tests are not a completed live payment or fulfillment test.

## Supplier connection

Use the [Supliful Shopify app](https://apps.shopify.com/supliful) and the [official connection guide](https://help.supliful.com/en/articles/5414192-how-to-connect-supliful-to-shopify). Confirm the existing supplier account and product mappings so orders route to Supliful rather than the manual location.

The current app listing distinguishes a free connection/sample plan from paid automatic order fulfillment. Do not subscribe or accept recurring charges without the merchant's selection. Installation also requires reviewing the app's requested Shopify access.

After stock/fulfillment is established, run `npm run check:shopify -- --cart` with the existing private Storefront credentials in a secure runtime. It creates and empties a cart without placing an order. Then verify mixed-cart shipping and a Shopify test-mode payment before real launch.
