# S8939 skincare purchase activation — release gates (NOT executed)

The storefront now supports a CONDITIONAL launch of exactly the eight invoice products.
Nothing is purchasable until every gate below holds for a product in production.

## How qualification works (`lib/skincare-launch.ts`)
- `lib/skincare-launch-identity.json` binds exact store `nr9zd0-t5.myshopify.com` + handle +
  supplier SKU + approved one-time USD price to Shopify product/variant GIDs. Five ids are
  copied from the proven read-only provisioning manifest; Enzyme Gel Cleanser, Hyaluronic
  Serum and Peptide Anti-Wrinkle Day Cream are `null` (not created) and therefore held.
- On every catalog read and every cart add/update/checkout, a fresh Storefront
  `nodes(ids)` read must return that exact variant on that exact product/handle (ACTIVE and
  published to this channel), tagged `iqon-skincare` only, available, one-time only, at the
  exact approved price, with a positive integer `quantityAvailable`. Anything else holds it.
- Legacy `anti-aging-cleanser-with-peptides` and `hydrating-tonic` are permanently held.
- Approved INCI, directions, images and page layout are unchanged (hash-pinned).
- Skincare is never bundle eligible; the 10% code remains cart-wide; no subscriptions.

## Gates before any product leaves "Coming soon"
1. Ops creates the three new products (DRAFT) and the proven manifest supplies their ids;
   update the identity JSON from that manifest only (never by hand), review, deploy.
2. The Storefront token must expose `quantityAvailable` (unauthenticated_read_product_inventory);
   without it qualification fails closed (by design).
3. Health opening stock is set by the reviewed CAS step; Shopify `available` > 0.
4. Products are ACTIVE and published to the headless channel at the approved prices.
5. Shipping weights/dimensions require a source (not guessed) before publication.
6. Live readback: each PDP shows the approved price and Add to bag; legacy pages held;
   11 supplements, bundles and the 10% code unchanged.
