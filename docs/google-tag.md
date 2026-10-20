# Storefront Google tag foundation (default off)

`lib/google-tag.ts` and `StorefrontGoogleTag` add a consent-aware gtag.js
foundation beside the Meta pixel. It is **inactive in every environment today**:
no Google script, `dataLayer` entry or network request happens unless all of these hold.

1. `NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED=true` and every supplied value is valid
   (`AW-<digits>`, `G-<A-Z0-9>`, label `[A-Za-z0-9_-]{6,40}`, at least one tag ID).
   Any invalid value disables the whole tag.
2. `window.location.hostname` is listed in `NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES`
   (no wildcards), so Vercel previews and local dev stay untagged.
3. The browser does not send Global Privacy Control, and the route is not
   `/account`, `/affiliates` or `/api` (same rule as the Meta pixel).
4. A **qualified consent source** has called `setGoogleConsent({analytics, advertising})`.
   No source is wired: main has no Shopify Customer Privacy API or CMP integration,
   only GPC and Shopify-hosted opt-out pages. Unknown, loading or error must pass `null`.

## Behavior once permitted (basic consent mode)

- Queued first: `consent default` with `ad_storage`, `analytics_storage`,
  `ad_user_data`, `ad_personalization` all `denied`; `ads_data_redaction` true;
  `url_passthrough` false. Then `consent update`, then `js`/`config`, then the
  single gtag.js script. Without a granted purpose nothing is queued or loaded.
- `analytics` grants `analytics_storage` and configures GA4 only. `advertising`
  grants `ad_storage` + `ad_user_data` and configures Ads only.
  `ad_personalization` is always denied; every config sets `send_page_view:false`,
  `allow_google_signals:false`, `allow_ad_personalization_signals:false`.
  No enhanced conversions, user data, remarketing or URL passthrough.
- `page_view` (GA4 only): one per App Router path/query, deduplicated across
  effect replay. `page_location` keeps only `utm_*`, plus `gclid`/`gbraid`/`wbraid`
  when advertising is granted. On a grant, only the current page is sent; nothing
  observed while denied is replayed. Disable GA4 enhanced-measurement
  "page changes based on browser history events" in the GA4 stream to avoid
  double counting.
- `add_to_cart`: only after the shared cart-add request succeeds, bounded by the
  returned line (same rule as Meta), USD only, `item_id` (numeric variant), price
  and quantity; no product names. Ads receives it only via
  `AW-…/<NEXT_PUBLIC_GOOGLE_ADS_ADD_TO_CART_LABEL>` and should be a secondary action.
- Withdrawal (or GPC, or entering an excluded route) pushes `consent update`
  with everything denied and stops events. The loaded script stays until a full navigation.
- All calls are wrapped so a blocked/broken tag never affects cart or checkout.

## Not owned here

No `purchase`, `begin_checkout`, `add_payment_info` or conversion event is
emitted anywhere in Next.js, including the `/checkout` bag-review page and the
checkout redirect. Purchase is reserved for the official Shopify Google & YouTube
app after domain, consent and account review. No Purchase webhook, server relay,
cart attributes or linker handoff was added.

## Before activation (owner decisions; see the tracking-build RESULT)

- Consent source: wire Shopify Customer Privacy API (needs checkout on the same
  root domain and a public Storefront token) or an approved CMP, with an agreed
  purpose mapping and GPC treatment; add Google to the `/account/privacy` copy.
- Tag IDs, add-to-cart label, production hostnames; GA4 history-event setting.
- Official app install, checkout domain, Purchase semantics and single primary action.

## Validation

```sh
npm run test:tracking
npm run typecheck:next
npx eslint lib/google-tag.ts app/google-tag.tsx tests/google-tag.test.ts
npm run build:vercel
```

Rollback: revert the PR. With the flag unset there is nothing to disable.
