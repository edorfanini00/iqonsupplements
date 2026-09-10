# IQON Shopify connection

Updated 10 September 2026.

## Verified state

The connected Shopify admin store is **nr9zd0-t5.myshopify.com**, currently named **My Store**, on a **trial**, using **USD** with **US** shipping destinations. The website remains on Vercel. No Storefront private token is available in this workspace or the current website configuration, so live checkout activation and an end-to-end payment test are still pending.

The launch import contains **14 draft products**, **14 format variants** and **26 existing IQON product images**, preserving the website handles and packaging. All prices are proposals from the [pricing research](pricing-research-2026-09-10.md). See [the catalog manifest](shopify-launch-catalog.json) for Shopify IDs, SKUs, formats, prices and media IDs. Inventory is tracked, with no invented stock and no overselling. Products remain unpublished. The three skincare records retain their concept descriptions and a formula-pending tag.

The connected app cannot inspect Shopify Payments activation with its current scopes. The payment-account query returned an access error; this is **not evidence that payments are disabled**. No bank details, paid plan, payment provider, shipping rate or tax setting was changed. The store currently reports no supported digital wallets. This is an observation, not a complete payment-provider audit.

## Website implementation

The website already implements Shopify catalog loading, variant prices and currency, availability, persistent carts, quantity changes, removal and a fresh handoff to Shopify-hosted checkout. Shopify is authoritative for live prices and cart totals. Payment and address collection occur in Shopify checkout; IQON does not collect card details in React.

The catalog uses Storefront API **2026-07** and requires one merchandising tag per product:

- `iqon-supplements`
- `iqon-skincare`

The Shopify handle remains the website route at `/products/{handle}`. Products must be active, available in the relevant market, and published to the exact Headless storefront before they appear. Draft products are intentionally absent from the Storefront API. An authenticated empty catalog does not fall back to sample products.

The integration supports paginated products and up to 100 variants per product. Full cart IDs remain in HttpOnly, SameSite cookies. Cart writes validate same-origin requests, variant ownership, inventory availability and quantities. Responses and Shopify requests are not publicly cached. Only trusted hosting-edge buyer-IP headers are forwarded. Incomplete credentials or provider errors fail closed.

**One-time purchases are implemented. Recurring subscriptions are not yet enabled.** The preview's 15% calculation never enters live checkout. A real subscription launch requires a subscription app, Shopify selling plans, variant allocation prices and selling-plan-aware cart operations. The pricing report proposes future recurring prices; it does not claim this work is complete. Subscription-only products currently remain unavailable on purpose.

## Complete activation

1. In [the connected Shopify admin](https://admin.shopify.com/store/nr9zd0-t5), confirm the business/store identity and choose a paid plan when ready to sell. Basic is the pricing recommendation; no plan purchase has been made.
2. Add/open Shopify's **Headless** sales channel, create the IQON storefront and obtain its **private Storefront API token** with product/inventory access and cart/checkout permissions. The currently connected Admin app is not a substitute for that token.
3. In the **iqonsupplements Vercel project → Settings → Environment Variables**, configure the following together for the intended Preview and/or Production environment, then redeploy:

| Environment variable | Value |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | `nr9zd0-t5.myshopify.com` |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Private token from the IQON Headless storefront |
| `SHOPIFY_API_VERSION` | `2026-07` |

Enter the secret directly in Vercel. Do not paste it into chat, source code, screenshots or Git. Do not use `NEXT_PUBLIC_`, an Admin token, or the public Storefront token for this server-only setting. The same runtime variable names are supported by the retained Worker target, but this project is currently hosted on Vercel.

4. Review the proposed prices, confirm final labels/formulas, supplier costs and actual fulfillment inventory, and assign the correct inventory/fulfillment locations and shipping weights. No guessed stock, fulfillment service, product cost or shipping weight was imported. Finalize the three skincare formulas before publication. Keep the manifest in sync with approved price changes.
5. Configure payment processing and payout details in Shopify. The account owner must complete any required business/bank verification. Confirm the actual merchant billing country and rates before relying on the US fee examples in the pricing report.
6. Configure US shipping zones/rates, fulfillment and tax settings. The suggested $75 free-shipping threshold and $5.95 standard rate are cost-dependent proposals, not active settings. Match delivery estimates to the website's existing 3–5 business-day copy.
7. Set reviewed products to **Active**, publish them to the **IQON Headless storefront**, and add actual inventory. Keep the launch-review tags until the merchant has completed review. Do not activate draft concepts merely to make a test pass.
8. Run the checks below, then complete a checkout using the payment provider's test mode. Verify shipping, tax, discounts, confirmation emails and the resulting order. Turn off test mode before accepting real payments. No test or real order has been submitted in this work.

## Launch verification command

With the secret available in the shell environment (or a locally ignored `.env` file):

```sh
npm run check:shopify
# Optional local env-file loading, if you have created .env securely:
node --env-file=.env scripts/check-shopify.mjs
```

The default check is read-only. It confirms the intended store domain and checks all 14 expected handles, USD prices, pack formats, images and availability against `docs/shopify-launch-catalog.json`. Missing draft products are reported as not yet published. Approved price changes require updating the proposal manifest so a stale proposal is not mistaken for the intended live price.

After the catalog passes, an optional cart smoke check creates a cart, reads it back, verifies an HTTPS checkout URL and empties the cart. It never submits an order, opens a payment session in a browser or charges a card:

```sh
npm run check:shopify -- --cart
```

Passing this command proves the catalog/cart connection, not successful payment processing. Browser verification must still cover mobile and desktop add/update/remove, bag restoration, actual checkout, shipping/tax calculations and a payment test. Preserve the existing design and mobile layout while doing this.

## Sources

Verification for this handoff: all 14 records were read back from Shopify and matched the expected draft status, price, variant and zero initial inventory; all 26 uploaded media records reported READY. The seven existing Shopify tests passed, and Shopify's validators accepted the Admin import mutation and Storefront catalog/cart operations. The launch command correctly stops when credentials are absent. A live Storefront and payment test remains pending the activation steps above.

- [Storefront authentication and API](https://shopify.dev/docs/api/storefront/2026-07)
- [Build and manage a cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage)
- [Headless subscription implementation](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/products-collections/subscriptions)
- [Shopify Payments onboarding](https://help.shopify.com/en/manual/payments/shopify-payments/onboarding)
- [Shopify plan pricing](https://www.shopify.com/pricing)
