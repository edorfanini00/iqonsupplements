# Storefront Meta pixel

The US-only storefront uses Meta dataset `1006368245818889`. The public
`NEXT_PUBLIC_META_PIXEL_ID` environment variable can override the committed default.
`StorefrontMetaPixel` runs in the existing storefront shell inside the root layout.
It loads `fbevents.js` once using `next/script`, after hydration and only when the
browser does not report Global Privacy Control.

Explicit events:
- `PageView`: initial page and App Router pathname/query changes, deduplicated on effect replay.
- `ViewContent`: live product pages and selected variant changes; numeric Shopify variant ID, USD price and product name.
- `AddToCart`: successful shared cart-add response only; confirmed quantity increase and returned line price, including subscription plans.

Account, affiliate and API routes are excluded. Direct portal loads do not load
the script. On client navigation into a portal, Meta consent is revoked and no
explicit events are sent; automatic Meta configuration is disabled. The script
already loaded in the document remains until a full navigation. GPC is checked
before initialization and every explicit event. There is no custom consent banner,
consent persistence, tracker API, database, visitor cookie, or WAF change.

The existing `/account/privacy` page retains Shopify-hosted policy and choice
links. Shopify checkout handles its own consent and checkout/payment/purchase
tracking through the already-configured Facebook & Instagram integration. The
headless storefront sends no `InitiateCheckout` or `Purchase` event. Checkout and
Shopify cart operations are unchanged. `_fbp`/`_fbc` passthrough is omitted because
there is no existing cart-attribute handoff; cross-surface attribution was not verified.
No CSP is configured in the application, so no policy change was needed.

Validation (Node 22):

```sh
node --import tsx --test tests/meta-pixel.test.ts
npm run typecheck:next
npm run build:vercel
node --test tests/shopify.test.mjs tests/cart-routes.test.mjs tests/merchandise.test.mjs tests/hosted-privacy-release.test.mjs tests/vercel-build-parity.test.mjs
npm run lint
```

Repository-wide lint has existing failures. New pixel files must pass ESLint;
compare existing touched-file diagnostics against the base branch.
Browser verification uses task-owned managed Hermes Chrome tabs: home → product
→ add to bag, capture `facebook.com/tr` payloads and HTTP responses. Never complete
checkout or place an order. Verify GPC and portal exclusions separately.

Rollback: revert the standard-pixel PR merge commit and let Vercel deploy `main`.
No migration or Shopify/Meta setting change is needed.
