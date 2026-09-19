# Native provider / marketing closure — local partial implementation

## Outcome and exact scope

**Six of the thirteen assigned method entries now have runnable, individually mounted Body adapters, original-Health coordination, durable uncertainty barriers and unchanged-form action wiring. Seven entries remain unimplemented/blocked. This is not full provider closure, production readiness, or live delivery acceptance.**

Isolated Health worktree `/Users/edorfanini/Projects/iqon-provider-health`, base `ba3321101b9ecff8d5a75d5c7847d1a54e4437e0`. Isolated Body worktree `/Users/edorfanini/Projects/iqon-provider-body`, base `f022ffc71c72b91a701a9bb254c45be68ebea9fb`. Both branches are named `feat/native-provider-closure` in their respective repositories. No changes were made to other implementation worktrees.

Paths below are relative to `/api/affiliates/`:

| Method | Implementation |
|---|---|
| POST `admin/test-email` | Fixed Health Resend source, existing template/service/DTO, strict positive provider-ID confirmation; logged mode or error cannot acknowledge delivery. |
| POST `admin/customers/email` | Fixed Health customer mailer/source, exact existing recipient/subject/message fields, original branded template and DTO. Partial/unknown/logged delivery leaves a non-retryable receipt. |
| POST `admin/marketing/campaigns` | Original create service and DTO, keyed receipt, fixed canonical Health campaign store. |
| PATCH `admin/marketing/campaigns/[id]` | Original active/paused contract, keyed receipt; archived campaigns cannot reactivate. |
| DELETE `admin/marketing/campaigns/[id]` | Existing `{ok:true,deleted:true}` acknowledgement now means archival: campaign and recipient rows remain; active list excludes archived campaigns. This is an explicit preservation-compatible behavior change, not physical deletion. |
| POST `admin/marketing/campaigns/[id]/run` | Original runner/DTO with durable recipient admission shared by Health, Body and cron; no automatic resend after uncertain delivery. |

Body maps only these six exact method/path combinations. Unsupported provider paths remain blocked. No Woo or Shopify credentials are used by this slice; no caller-supplied source/store/credential selector is accepted. Body forwards only its existing trusted canonical relay headers, cookies and operation key to Health. Body's independent email/campaign services are not activated.

## Coordination and uncertainty behavior

`lib/integrations/body/provider-command.ts` authenticates current canonical admin authority on every attempt/replay, validates exact fields/targets/query absence, and commits an `affiliate_commands` uncertainty receipt before invoking the static original handler. UUID is bound to actor, method, fixed source, operation, target and payload hash. No raw request body or provider exception is journaled. A conflicting key returns409. An uncertain target cannot be bypassed by submitting another key. Confirmed replay returns the exact original successful DTO.

Original Health exports delegate through the same boundary. Both portals' existing forms use the UUID-only `providerMutationFetch` helper. No layout, tabs or markup were redesigned. A truncated or negative HTTP200 acknowledgement throws before the original form can clear; an uncertain attempt retains its UUID. No automatic retry loop exists. Conservative admission can block an entire operation family (e.g. create-campaign) while its prior outcome is unresolved.

Campaign recipient rows are atomically changed from `queued` to `uncertain` before provider calls. That logic lives in the shared runner, so cron and original Health run actions cannot freely send the same recipient around the Body receipt. Unknown recipients stay non-retryable, block automatic completion, and are conservatively represented in the existing failed count/status DTO with a reconciliation-required error. A completion update cannot resurrect an archived/paused campaign. Archival does not retract a send already admitted before the archive; no such claim is made.

Existing mailer transport errors are reduced to fixed safe messages rather than returning/logging arbitrary provider exception objects. Templates, recipient resolution and source credential selection are otherwise retained.

**Remaining qualification for these six:** receipt storage and campaign admission were exercised with synthetic DB drivers, not real PostgreSQL; there is no operator-facing evidence-backed reconciliation command for uncertain outcomes. The pre-effect barrier is intentionally fail-closed, not a lease or resend button. Campaign database effects and their final response receipt are not one atomic transaction; an acknowledgement failure leaves uncertainty rather than fabricating success. Real Next/browser forms and current authenticated production/provider delivery remain unqualified. Do not deploy or claim operational completeness from these tests.

## Exact remaining seven entries

1. POST `admin/woocommerce-sync`: original ingest also sends order notifications; it needs shared ingestion/notification coordination across manual sync and other ingest writers, not a response-only wrapper.
2. POST `admin/portal-commerce-sync`: the inspected Body route calls its own `syncShopifyOrders` behind `sharedJobAuthorityGuard`; the pinned Health tree has no matching canonical original route. A fixed canonical Shopify/source/highwater adapter and exact result contract remain to be implemented. Do not dispatch this to Woo or re-enable Body's independent authority.
3. POST `admin/orders/[id]/attribute`: reassignment and notification effects require canonical financial reversal plus source/readback coordination. The original attribution service sends primary/referrer email after recording commissions.
4. DELETE `admin/orders/[id]/attribute`: original `removeWooOrderAttribution` calls `voidPendingOrdersForWooOrder`; the pinned `lib/affiliates/store.ts` implementation calls `affiliateOrder.deleteMany`. No hard-delete adapter was enabled.
5. POST `admin/orders/[id]/refund`: provider order update, pending commission void and inventory compensation/return must be coordinated without uncertain retry. Its pending-commission void currently reaches the same hard-delete service. The accounting signed-correction dependency below is accounted for, but does not by itself qualify the financial/provider operation.
6. POST `admin/subscriptions/[id]`: exact cancel/refund/pause/resume/interval/items/charge-now behaviors remain. Existing immediate renewal catches failures and records renewal failure; source charge uncertainty must be coordinated with account/cron writers before enabling native retries. Subscription refund also calls `voidPendingOrdersForWooOrder`.
7. GET `orders/[id]?refresh=1`: writes the Woo snapshot after current order-ownership checks. A dedicated source-bound refresh/ownership/recovery adapter and write-like BFF origin/prefetch handling remain; no broad GET proxy exception was added.

These are implementation blockers, not merely missing production credentials. No success response or new Body mapping was invented for them. Financial deletion changes must coordinate with the separate non-provider/financial worker rather than overwrite its store changes.

## Accounting dependency and actual synthetic refund check

Read `/Users/edorfanini/Projects/iqon-accounting-coexistence/accounting-coexistence-closure.md` lines18–47. Required implementation commit: `64ad217d372f428f72364001176380b7553ccb36`; report commit: `f135954081e73bb2ba5f5cec502a2e71cebf1428` (read-back HEAD matched the latter). **Neither commit was cherry-picked.**

That candidate makes `deleteAdjustment` append a signed correction and retain its original, using the shared accounting admission/receipt service. The refund route must not assume physical removal. Added and executed `native-refund-accounting-dependency.test.ts`: real original refund HTTP handler with synthetic Woo/auth/store transport, plus the actual extracted `reverseAccountingRows` algorithm from the supplied dependency. Refund created the -2-unit compensation; return appended +2; repeated return reused the reversal receipt; net was0 with both original and correction preserved. The test prefers the combined local `lib/accounting/reversal.ts` when integrated, otherwise reads the explicitly supplied isolated dependency. No files in that dependency were edited.

This test uses an in-memory transaction/receipt driver around the actual algorithm. It **does not** prove the future combined PostgreSQL service's lock/atomicity, financial commission reversal, actual provider refund or native refund adapter. Repeat against the combined real service before closing refund acceptance.

## Executed checks

Node executable: `/Users/edorfanini/.nvm/versions/node/v22.23.2/bin/node`. Reused existing dependency trees via local ignored node_modules symlinks; no install/build/database creation/reset.

Health final bounded run: **21 passed,0 failed/skipped across8 files**, process exit0. Machine-readable actual Vitest output: `native-provider-health-results.json`.

- `native-provider-command.test.ts`:9, including six actual exported Request-object adapter invocations and exact DTO replay, claim-before-effect, lost final receipt/new-key barrier, revocation and source-field/key conflicts. Services/auth/DB are synthetic in these mount tests.
- `native-marketing.test.ts`:5; real shared runner with synthetic DB/mailer, pre-send claims, no resend after loss, archive preservation/non-resurrection and logged mode not delivered.
- `native-marketing-input.test.ts`:1.
- `native-marketing-mount.test.ts`:1 source-mount inventory check, not browser acceptance.
- `native-provider-mail-input.test.ts`:1.
- `native-provider-mailer.test.ts`:1; synthetic Resend SDK throws a marker, safe error output verified.
- Existing `native-effect.test.ts`:2 regression tests.
- `native-refund-accounting-dependency.test.ts`:1 as qualified above.

Body bounded run: **11 passed,0 failed/skipped**, `node --import tsx --test tests/affiliates/native-provider-relay.test.ts tests/affiliates/native-provider-client.test.ts tests/affiliates/body-integration-contract.test.ts`.

Health `tsc --noEmit --incremental false` and Body `tsc -p tsconfig.next.json --noEmit --incremental false`: both exit0. `git diff --check`: exit0. No full production builds were run.

Observed RED failures preceded the implementation: absent provider module/mounts/validators, marketing physical deletion/queued-before-send, archive resurrection, raw error leakage, Body six mappings rejected, and truncated-success client failure. An initial Body Vitest invocation used Node20/wrong config and failed before tests; switched to the repository's actual Node22/tsx test runner. Existing read-only marketing contract initially expected501 for unkeyed create, now correctly expects400 while continuing to assert no upstream send. These failed attempts are not counted as passing checks.

## Protected boundaries

No production/deployment/push/merge/config/migration/Analytics changes; no access to `/Users/edorfanini/IQON`; no real emails, orders, refunds, subscriptions or provider calls; no file/cache/database deletion or cleanup; no tunnel/stale deployment automation changes. Last local capacity read was769MiB available: no new full builds or DB rehearsals were started. Test mocks do not read production secrets. Complete integration and production acceptance remain explicitly blocked.
