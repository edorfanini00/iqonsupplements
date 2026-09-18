# Body payout parity — final browser closure

## Outcome

The native Body payout modal now reads canonical all-time outstanding through an exact allowlisted relay, displays the selected currency bucket, and submits explicit amount plus exact signed allocations. Original historical reports, totals, export formats and page layout were not redefined.

Base Body: `6f40f501eea882809d71fe6d8fe0452569f503c9`. Health was read-only at `d33f686348f9d080052e7a5ad173a81995e6bc6c`; its working tree and frozen application sources remain unchanged. This commit is a candidate for the parent's independent review, not a deployment or an independently reviewed `[verified]` commit.

## Real browser + PostgreSQL acceptance

Actual headless Chrome used the native payout page on Body HTTPS34542, the existing Health HTTPS34541 production-mode server, and disposable PostgreSQL `iqon_payout_parity_test`. Preserved synthetic JWT/current-provider identity fixtures and the local certificate were reused. Browser/server remote networking was blocked; no live login or provider/payment operation is claimed.

1. The untouched `payout-browser-fixture` returned historical pending **85**, but the new outstanding read and actual modal showed **USD71.00**, with six exact allocations.
2. Clicking **Mark as paid** submitted amount71 and the DTO's allocations, not historical order commissions or inferred order IDs. The real server committed71; the browser deliberately dropped that successful response.
3. Closing/reopening restored71 and the original payment details. A second click retried the **byte-identical command payload/key** and closed the modal only after a matching canonical receipt.
4. Direct PostgreSQL readback verified amount71, USD, completed status, exact allocation amounts, **one new payout**, and **one payout for the idempotency key**. Fresh outstanding was empty.

Original command: `88485aa7-581e-4891-a380-ba8c15db1661`; payout: `cmu69aybg000c8zwjzou9xkpe`.

After a small form-state/lint cleanup, the final built source repeated the entire browser sequence on a separately named `payout-browser-final-fixture`. The original consumed fixture was **not reset or reseeded**. New fixture prior partial/negative payments were created through the real canonical writer, not invented payout rows.

Final-source command: `a0827365-adce-4190-bb82-b82ccbe58911`; payout: `cmu69medj000n8zwjj3elt1co`. Again71, byte-identical retry, one new payout, zero outstanding, and no browser page errors. Screenshots were visually inspected and visibly label synthetic boundaries.

## Changes

- `lib/affiliates/shared-relay.ts`: only GET `/api/affiliates/payouts/outstanding?affiliateId=...` maps to `/api/integrations/body/payouts/outstanding`. Additional filters, duplicate parameters, missing affiliate ID, alternate paths and writes are rejected; existing trusted relay authentication remains authoritative.
- `lib/affiliates/use-payout-outstanding.ts`: validates the DTO; keeps currency buckets separate; blocks unknown/nonpositive buckets; preserves partial allocations and required negative offsets; refreshes on open and before a new submission. Changed balances require review; failed reads clear stale values. Closed-modal responses cannot overwrite a reopened modal. Saved attempts retain exact payload/key and payment details even when outstanding becomes zero; definite validation rejection offers explicit no-record correction through the existing command client.
- `app/affiliates/admin/payouts/page.tsx`: changes only the settlement modal/import, retaining original styling and historical report semantics. Saved form values derive directly from the immutable attempt. Currency display metadata stays outside the canonical payload.
- Added relay and native-page regression tests. Extended the existing preservation test with exact reviewed modal/import hunks; the original Health source-hash fixture remains untouched and all non-adapted bytes still hash identically.

## Executed checks

| Check | Result |
|---|---|
| Native financial RED | Old modal lacked USD71; original displayed85 |
| Affiliate test suite | **134 passed, 0 failed, 4 existing opt-in skips** (138 total) |
| Full affiliate UI suite | **51 passed, 0 failed**, including7 payout regressions |
| TypeScript `typecheck:next` | exit0 |
| Checked-in `npm run build:vercel`, Node22.23.2 | exit0; rebuilt final source |
| Real browser/DB workflow | Both original and final-source fixtures passed |
| Source binding | No Body build-snapshot drift; no Health application drift |
| Static added-code security scan / diff check | no matches / exit0 |
| Focused ESLint | Two unchanged baseline errors in historical page; zero new findings |

Regressions cover selectable currencies, unknown/nonpositive blocking, partial payment and signed refund allocations, changed-balance preflight, failed-read clearing, late closed-modal responses, immutable close/reopen retry, and explicit rejected/no-record correction with a new key. The fixture's original signed negative was already settled by its prior canonical payment; additional signed-refund paths are exercised in native UI regressions and Health's existing canonical PostgreSQL parity tests, not mislabeled as new browser refund operations.

## Evidence and cleanup

Runtime root: `/Users/edorfanini/.hermes/runtime/iqon-shared-affiliates/`.

- `body-payout-parity-browser-evidence.json` — original requested fixture; minimal financial readback, no auth cookies.
- `body-payout-parity-final-browser-evidence.json` — final built source and second isolated fixture.
- `body-payout-parity-final-modal71.png`, `...-unknown.png`, `...-recorded.png` — final browser screenshots.
- `body-payout-parity-browser.cjs`, `body-payout-parity-run.py` — reproducible local browser/build/server drivers. Browser fixtures are consumed; do not rerun their one-shot seeds.
- `body-payout-parity-ui-final.json`, `body-payout-parity-affiliate-final.log`, `body-payout-parity-types.log`, `body-payout-parity-build.log`, `body-payout-parity-lint{,-baseline}.log`.
- `body-payout-parity-source-manifest.json`, `body-payout-parity-source-verification.json` — SHA256 source binding, Health read-only confirmation and server shutdown checks.

The coordinated verification servers on34541 and34542 were stopped after successful final evidence; listener absence was checked. The shared local PostgreSQL cluster and both fixture receipts remain preserved. No production writes, deployments, pushes, migrations, provider mutations, email delivery or funds transfers occurred.

## Issues encountered

Initial HTTP probing was inappropriate for the HTTPS-only Health fixture; local-CA HTTPS verified401 readiness without restarting it. The existing full-file preservation assertion correctly failed until the exact settlement-only adaptation was declared. Test-harness selector duplication and an async form assertion were corrected. A runtime seed initially referenced an unavailable Health tsx install, performed no writes, and succeeded using the installed Body tsx with Health's explicit tsconfig. Focused lint retains the same two pre-existing historical-page errors; those unrelated sections were intentionally not rewritten. Parent independent review remains outstanding.
