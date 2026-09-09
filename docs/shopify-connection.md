# Shopify connection

The storefront now includes Shopify catalog loading, variant selection, persistent carts, quantity changes, removal, and a handoff to Shopify-hosted checkout. The store has **not yet been authenticated or connected**. No products or orders have been created in Shopify.

## Required store connection

Provide the merchant's actual `handle.myshopify.com` or Shopify admin URL. Complete the Shopify store authorization flow, then create the storefront in Shopify's Headless sales channel. Configure these runtime values through the site's hosting environment:

| Key | Value |
| --- | --- |
| `SHOPIFY_STORE_DOMAIN` | The exact `handle.myshopify.com` domain, without a protocol or path |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | The private Storefront token from the Headless channel; store as a secret |
| `SHOPIFY_API_VERSION` | `2026-07` |

The website never needs an Admin API token. The private Storefront token must remain on the server. Never put token values in Git, browser code, a screenshot, or a public issue. Local `.env` is ignored; `.env.example` contains names only.

## Product import

The original IQON supplement folder was not present in the files accessible during this update. The available IQON images were brand/research-vial references and earlier concept artwork. No unverified product names, prices, formulas, inventory, or research-use products were imported as consumer supplements.

After the original files are provided, match each image to its actual product and variant. Import verified records as drafts, preserving approved descriptions, package quantities, ingredients, prices, and inventory. Use the real images as Shopify product media. Resolve missing commercial fields before publication.

Publish approved products to the Headless channel and add exactly one merchandising tag:

- `iqon-supplements`
- `iqon-skincare`

Only products with one of these tags enter the website. The product's Shopify handle becomes its website URL at `/products/{handle}`. Collections, search, product cards, galleries, variants, and prices read from Shopify; no code edit is needed for ordinary product updates.

The catalog supports paginated products and up to 100 variants per product. Products exceeding that variant count return a controlled unavailable state rather than a silently incomplete option list. One-time purchases are implemented. Subscription-only products remain unavailable until real selling plans and subscription operations are implemented; the old sample 15% option is never used in live commerce.

## Checkout and hosting

Cart writes validate the same-origin request, product/variant membership, availability, quantities, and line ownership. Shopify sets the prices and authoritative cart totals. Full cart IDs stay in HttpOnly, SameSite cookies and are excluded from response bodies. Responses are not publicly cached. Buyer IP is forwarded from Cloudflare's connecting-IP header. Checkout obtains a fresh checkout URL from Shopify; payment and delivery-address entry take place there.

Without a store connection, the site remains an explicitly labelled design preview. Incomplete credentials or Shopify failures show an unavailable state, never a fallback catalog of purchasable sample products.

After credentials are configured, deploy the existing site and verify product media, all variant prices, add/update/remove, bag restoration, stock changes, and a checkout handoff. Confirm the merchant's payment provider, currency, shipping zones/rates, policies, and tax configuration in Shopify before accepting orders. These business settings have not been supplied or configured. No transaction has been placed.

## Documentation and validation

- [Shopify Storefront authentication](https://shopify.dev/docs/api/storefront/2026-07)
- [Products query](https://shopify.dev/docs/api/storefront/latest/queries/products)
- [Create and update a cart](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage)
- [Add cart lines](https://shopify.dev/docs/api/storefront/latest/mutations/cartLinesAdd)

The generated operations were validated with Shopify's supplied schema validator. Focused tests cover catalog mapping, currency/stock handling, request validation, error privacy, and removal of cart secrets from browser responses. End-to-end verification against the merchant's store is pending authentication.
