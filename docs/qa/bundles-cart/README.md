# Bundle choices and cart alignment

The screenshots show actual Shopify merchandise and amounts, captured in ordinary Chromium without image substitution. `before-320-bag.png` is production main before this change; the after images are the candidate preview. No contact/payment data or order submission was used.

- [Cleanse choices, 320px](after-320-cleanse-choices.png): the approved 10%/25% unit prices appear before the gallery.
- [Before, 320px](before-320-bag.png)
- [After, 320px](after-320-bag.png): quantity and current amount share a baseline; old/current amounts and the summary share a right edge.
- [Mixed products, 390px](after-390-mixed-bag.png): long product names and different monetary widths preserve the price column.
- [After, 1440px](after-1440-bag.png): the same layout applies to the drawer and bag review page.

Backend prerequisite: the owner approved adding Colon Gentle Cleanse to both existing automatic discount product sets on 29 October 2026. The approved two-product-set updates were read back before real candidate verification; rates, minimum quantities, combination rules, base prices, inventory, and availability were preserved. The frontend must follow the backend inclusion, never precede it.

The complete sanitized catalog, 48-case cart geometry/Shopify reconciliation matrix, all-product browser receipts, before/after Admin snapshots, approved patch/rollback payloads and release handoff are in `/Users/edorfanini/.hermes/workspace/iqon-body-bundles-cart-alignment/` for the parent release coordinator. Independent exact-head reviews, merge and deployment remain parent-owned.
