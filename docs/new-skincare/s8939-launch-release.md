# S8939 skincare purchase activation — release gates (NOT executed)

The storefront now supports a CONDITIONAL launch of exactly the eight invoice products.
Nothing is purchasable until every gate below holds for a product in production.

## How qualification works (`lib/skincare-launch.ts`)
- `lib/skincare-launch-identity.json` binds exact store `nr9zd0-t5.myshopify.com` + handle +
  supplier SKU + approved one-time USD price to Shopify product/variant GIDs for all eight.
  The ids are generated programmatically from the final saved ops provisioning manifest
  (`provision-resume/manifest.json`, private, not in this repo), SHA256
  `fdac7afbb14275166fbae98c413096b102985c8a7d1175b4d151a6e722275de7`, state
  `DRAFT_PROVISIONING_COMPLETE_COORDINATED_RELEASE_NOT_EXECUTED`, captured 2026-11-10T13:58:42Z.
  The five pre-existing ids are unchanged; Enzyme Gel Cleanser, Hyaluronic Serum and Peptide
  Anti-Wrinkle Day Cream (previously `null`) were bound from it. The generator refuses on any
  hash, state, store, handle, supplier SKU, approved price, uniqueness or existing-id mismatch.
- That manifest is a DRAFT-provisioning snapshot, not a live inventory/publication
  qualification: it records all eight as `DRAFT`, unpublished (no publications), no stock
  written (three new products 0 on hand, five existing 18 on hand pending the gated opening-stock
  correction to the owner's physical count), publish mutation not permitted, CAS write not ready.
- **All eight ids configured is not activation.** A DRAFT or unpublished product is absent from
  the Storefront `nodes(ids)` answer, so every product stays "Coming soon" until gates 2–5 below
  hold in production. There is no runtime override or bypass flag.
- On every catalog read and every cart add/update/checkout, a fresh Storefront
  `nodes(ids)` read must return that exact variant on that exact product/handle (ACTIVE and
  published to this channel), tagged `iqon-skincare` only, available, one-time only, at the
  exact approved price, with a positive integer `quantityAvailable`. Anything else holds it.
- Legacy `anti-aging-cleanser-with-peptides` and `hydrating-tonic` are permanently held.
- Approved INCI, directions, images and page layout are unchanged (hash-pinned). A qualified
  product keeps every approved content field; only price/variant/stock/availability come from
  the fresh read. This includes the Retinol Rx 0.75% supplier-attributed strength copy (PR #45):
  description, ingredients, summary lead with attribution, key fact, ingredient summary, and the
  page/Open Graph/Twitter description (`tests/skincare-launch-commerce.test.mjs` D-CONT-2 and the
  browser harness).
- Skincare is never bundle eligible; the 10% code remains cart-wide; no subscriptions.

## Gates before any product leaves "Coming soon"
1. Identity binding — DONE in source, not yet deployed: the three new DRAFT products exist and
   their ids are bound from the manifest above (never by hand). Review and deploy this source
   before or with the coordinated release; deploying it alone purchases nothing.
2. The Storefront token must expose `quantityAvailable` (unauthenticated_read_product_inventory);
   without it qualification fails closed (by design).
3. Health opening stock is set by the reviewed CAS step; Shopify `available` > 0.
4. Products are ACTIVE and published to the headless channel at the approved prices.
5. Shipping weights/dimensions require a source (not guessed) before publication.
6. Live readback: each PDP shows the approved price and Add to bag; legacy pages held;
   11 supplements, bundles and the 10% code unchanged.
