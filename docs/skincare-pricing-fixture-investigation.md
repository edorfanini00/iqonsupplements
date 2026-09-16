# Skincare pricing-fixture discrepancy resolved by owner confirmation

Edoardo confirmed that the higher `approved-prices.json` values are correct. Updated the six stale prices in `skincare-range.json` to those approved amounts and changed the current-price test to use the approved list, not the dated Shopify export. The historical export remains unchanged. Focused merchandise/Shopify verification: **11 passed, 0 failed**. No live Shopify price write or deployment was performed.

## Original investigation (before confirmation)

Reproduced separately with `node --test tests/merchandise.test.mjs tests/shopify.test.mjs`: 10 passed, 1 failed. Failure at merchandise.test.mjs:42, `55 !== 36`.

This is not introduced by the shared affiliate changes. Byte comparisons using `git show 233196f35a246326b0d5067a61a5a1a9d5d46156:<file>` show all four input/test files unchanged: lib/skincare-range.json, lib/approved-prices.json, docs/shopify-skincare-range-2026-09-11.json and tests/merchandise.test.mjs.

The first and archived Shopify fixture agree for all seven entries. approved-prices.json differs for six:

| Handle | skincare-range / archived Shopify | approved-prices |
|---|---:|---:|
| anti-aging-cleanser-with-peptides | 36 | 55 |
| hydrating-tonic | 32 | 48.34 |
| exfoliating-pads | 48 | 80 |
| hydra-c-ferulic-serum | 68 | 90 |
| retinol-rx | 64 | 98.34 |
| firming-peptide-eye-gel | 48 | 76.67 |
| copper-peptide-restore-cream | 68 | 68 |

The archived fixture is not evidence of today's live prices. approved-prices is imported by lib/catalog.ts and scripts/check-shopify.mjs, so changing it solely to satisfy the test could change behavior. No price inputs, Shopify prices or test expectations were changed. Resolve against a fresh scoped Shopify read and approved price source in a separate pricing change.
