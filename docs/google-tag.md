# Storefront Google tag foundation (default off, activation blocked)

`lib/google-tag.ts` and `StorefrontGoogleTag` add a consent-aware gtag.js
foundation beside the Meta pixel. It is **inactive in every environment today**.
No Google script, `dataLayer` entry or request happens unless all of these hold:

1. `NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED=true` and every supplied value is valid
   (`AW-<digits>`, `G-<A-Z0-9>`, at least one tag ID). Any invalid value disables
   the whole tag. There is no Ads conversion-label setting.
2. `window.location.hostname` is listed exactly in `NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES`
   (no wildcards), so previews and local dev stay untagged.
3. The browser does not send Global Privacy Control.
4. The page is one of the **advertised products**, `GOOGLE_PRODUCTS`:
   `/products/creatine-monohydrate`, `/products/hydrolyzed-collagen-peptides`
   (unflavored) and `/products/colostrum-powder`. Every other route is ineligible,
   including home, collections, other products (GLP-1 support, bowel health,
   chocolate collagen…), `/checkout`, account, affiliate and API routes.
5. The real document URL is clean. Its query may contain only Google Ads
   auto-tagging parameters, each at most once:
   - a well-formed click ID, `gclid`/`gbraid`/`wbraid` (`[A-Za-z0-9_-]{1,200}`);
   - and, only beside a click ID, strictly numeric `gad_source` (1–3 ASCII digits)
     and `gad_campaignid` (1–20 ASCII digits), which Google adds to ad-click URLs
     ([Google](https://support.google.com/google-ads/answer/16193746?hl=en)).

   Any other parameter (all `utm_*`, `dclid`, `fbclid`, `email`, tokens, discount
   codes), a repeated key or a malformed value makes the page ineligible. So does
   any fragment other than the storefront's own section anchors (`#main`,
   `#reviews`, `#product-formula`…); `#token=…`-style fragments fail closed and are
   never forwarded. A same-origin `document.referrer` must itself be an eligible
   URL. These checks apply to the document as well as the App Router route,
   because gtag.js falls back to `document.location`, `document.referrer` and
   `document.title`.
6. A **qualified consent source** has called
   `setGoogleConsent({analytics, adStorage, adUserData})`. **No source is wired.**
   Main has only GPC and the Shopify-hosted opt-out pages. Unknown, loading or error
   must pass `null`.

## Behavior once permitted (basic consent mode)

- Queue order: `consent default` with all four purposes denied, then
  `ads_data_redaction:true` and `url_passthrough:false`, then `consent update`,
  then `set` page metadata, then `js`/`config`, then the single gtag.js script.
  Without a granted purpose nothing is queued or loaded.
- `analytics` maps to `analytics_storage` and configures GA4 only. Ads is
  configured only when **both** `adStorage` and `adUserData` are granted.
  `ad_personalization` is always denied. Every config sets `send_page_view:false`,
  `allow_google_signals:false` and `allow_ad_personalization_signals:false`.
  There are no enhanced conversions, user data, remarketing or URL passthrough.
- **Page metadata**, set globally before config and before every hit:
  - `page_location` is origin + path. Click IDs and `gad_*` are included only
    when advertising is granted. No other query values and never the fragment.
  - `page_referrer` is origin-only.
  - `page_title` is the fixed string `IQON Daily`.
- `page_view` goes to GA4 only, once per App Router path and query.
- `add_to_cart` fires only after the shared cart-add request returns 200 **without
  a Shopify warning** (a stock cap may have added less than asked, so it isn't
  counted). It covers only the advertised products, USD only, and sends
  `item_id` (numeric variant), price and the requested quantity. No names.
  It goes to **GA4 only** and is informational: it is never sent to an Ads
  destination, is not a native Ads `conversion`, and must never be a bidding goal.
  A native Ads AddToCart action is deliberately out of scope.
- All calls are wrapped, so a blocked or broken tag never affects cart or checkout.

## Boundary after gtag.js may be running

Google documents `window['ga-disable-<ID>']` only when it's set **before any
gtag() call**, and denied consent still allows cookieless pings. So this code does
not rely on mid-page disabling. Once the script element exists, any narrower state
leaves the document:
- withdrawal, `null` consent, a narrower grant or GPC;
- a client navigation to an ineligible page.

On leaving, the code pushes a denied update, then:
- calls `location.reload()`;
- or, for a same-origin link click caught in the capture phase before Next's
  router, calls `location.assign(href)`, then also `location.reload()` when the
  target differs only by fragment (a same-document navigation doesn't unload).

The new document starts with no Google state. That also discards a still-pending
script load and its queue.

**Not proven, and there's no claim of zero Google network after consent
withdrawal or after load.** The unit tests mock Google and the browser: they prove
that `reload()`/`assign()` is *requested* and nothing more is queued, **not** that
already-queued Google hits cannot run before the document unloads. Unproven:
- whether gtag.js sends queued or new hits before or while unloading;
- whether automatic collection fires in the short interval before a reload
  triggered by `router.push` or back/forward (not link clicks);
- automatic events on eligible pages.

Activation stays blocked until the isolated real-runtime test below records the
exact outcome.

## Not owned here

No `purchase`, `begin_checkout`, `add_payment_info` or Ads `conversion` command is
emitted anywhere in Next.js, and no event is routed to an `AW-…/label`
destination, including on the `/checkout` bag page and the checkout redirect.
Purchase is reserved for the official Shopify Google & YouTube app.
No Purchase webhook, server relay, cart attributes or linker handoff was added.

## Activation gates (all required; owners in brackets)

1. **Consent source** [privacy owner]. Wire the Shopify Customer Privacy API or an
   approved CMP. Don't build a custom one. Get the exact purpose mapping approved:
   - which Shopify permission(s) (analytics, marketing, sale/sharing) grant
     `analytics`, `adStorage` and `adUserData`;
   - personalization stays denied;
   - GPC denies everything (current behavior);
   - withdrawal must persist across the reload.
   - the adapter must report `null` only before a choice is known, never
     transiently after a grant (each narrowing reloads the page).

   Shopify consent sharing requires checkout and storefront on the same root
   domain. Update the `/account/privacy` copy, which today mentions only Meta, at
   the same time.
2. **Real-runtime transition test** [engineering]. Use an isolated GA4 property
   and Ads test destination and capture network and cookies. Cover:
   - grant, then withdrawal, null, GPC, ineligible link click,
     `router.push`/back, and a delayed script load;
   - landing URLs with UTMs or tokens, and sensitive referrers.

   Record the exact requests and cookies. The mocked unit tests are not a
   substitute. Without this, don't activate.
3. **GA4 and Google tag settings** [Ads/GA4 owner]:
   - Enhanced measurement **off**: page changes from history events, scrolls,
     outbound clicks, site search, video, file downloads and form interactions.
   - Google tag: automatic event detection off, user-provided data collection off,
     enhanced conversions off, Google signals off, no cross-domain list unless
     reviewed.
4. **Ads goals** [Ads owner]:
   - Exactly one primary Purchase: the official app's native Ads action.
   - No GA4-imported purchase as a second primary.
   - No native Ads AddToCart action is created for this code. GA4 `add_to_cart`
     is informational only: don't import it into Ads as a conversion, and keep it
     out of every custom goal and campaign goal used for bidding.
   - Inspect the official app and custom-pixel overlap for duplicate storefront
     tags, and its default actions.
5. **Domains** [store owner]:
   - Current storefront: `www.iqondaily.com` (PR #18 migration).
   - Set `NEXT_PUBLIC_GOOGLE_TAG_HOSTNAMES` to the exact approved Daily host(s).
   - Legacy `iqonbody.com` hosts stay unlisted unless approved.
   - Checkout is still on `nr9zd0-t5.myshopify.com` (a different root). The
     programmatic `location.assign` checkout redirect isn't auto-decorated by
     Google's linker. Storefront-to-checkout attribution and consent sharing are
     unproven and out of scope here.
6. **Product eligibility, including the initial three** [store owner + policy
   review]. Before activation, the owner records a dated, written approval (who,
   when, decision) covering, for creatine monohydrate, unflavored hydrolyzed
   collagen peptides and colostrum powder:
   - the actual live landing-page content of each product page;
   - the exact transmitted fields (sanitized `page_location` with the product path
     and, under ad consent, auto-tagging parameters; origin-only referrer; fixed
     title; numeric variant `item_id`, price, quantity, value, USD);
   - compliance with Google's health-content and personalized-ads policies;
   - the intended use (GA4 measurement and Ads attribution only, no remarketing or
     audiences, `add_to_cart` never a bidding goal).

   The three-product allowlist implements the advertising scope; it is **not** that
   approval. Numeric variant IDs and paths still identify the product. Extending
   `GOOGLE_PRODUCTS`, the query or fragment allowlist, or the transmitted fields
   needs a new content-specific review and recorded approval.

## Rollback

`NEXT_PUBLIC_*` values are compiled into the client bundle. To disable:
1. Unset `NEXT_PUBLIC_GOOGLE_TRACKING_ENABLED` (or the IDs) in Vercel.
2. **Rebuild and redeploy**.
3. Verify that `grep -r "AW-\|G-<id>" .next/static` (or the deployed chunks) no
   longer contains the IDs.

Already-open pages keep the old bundle until they reload. Alternatively, revert
the PR.

## Validation

```sh
npm run test:tracking
npx vitest run --config tests/ui/vitest.config.mjs tests/ui/google-store-shell.test.ts
npm run typecheck:next
npx eslint lib/google-tag.ts app/google-tag.tsx tests/google-tag.test.ts tests/ui/google-store-shell.test.ts
npm run build:vercel
```
