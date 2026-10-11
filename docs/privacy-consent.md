# Storefront privacy choices and checkout consent

## What the visitor gets

- The footer shows **Privacy policy** (Shopify hosted policy) and **Your Privacy Choices** on every storefront page.
- **Your Privacy Choices** links to the public page `/account/privacy` (no sign-in needed), which shows these controls inline (`PrivacyPanel`). The same panel also backs `PrivacyChoicesSheet`. Both use the store shell's single `usePrivacy` state, and choices remain per browser, not per account.
- Your Privacy Choices records four purposes that match Shopify's `VisitorConsent`: `analytics`, `marketing` (shown as Advertising), `preferences` and `saleOfData`. Each one is granted (`true`), declined (`false`) or not expressed (`null`).
- **Not expressed stays not expressed.** It is never reported as a grant or a denial, and Shopify applies the merchant's regional settings to it (owner direction, October 2026).
- **Global Privacy Control** (`navigator.globalPrivacyControl` or `Sec-GPC: 1`) overrides advertising and sale or sharing to declined, and those controls are locked off.
- No advertising script, pixel, Meta event or Purchase path is added. Shopify's official Meta channel remains the only Purchase owner.

## Where the decision lives: the privacy ledger

Table `storefront_privacy_consents` in the storefront's existing PostgreSQL (`SUPPLEMENTS_DATABASE_URL`). Migration: `prisma/migrations/20261011000000_storefront_privacy_consents`.

**What a row holds**

| Column | Holds |
|---|---|
| `visitor_key` | SHA-256 of a random token held by the visitor's browser |
| `analytics`, `marketing`, `preferences`, `sale_of_data` | the four nullable choices |
| `revision` | counter, incremented by every change |
| `created_at`, `updated_at` | timestamps |

There are no customer, order, IP or device fields.

**How ordering works.** Ordering comes from PostgreSQL alone; no clock is ever compared. Every change is one conditional `UPDATE` that increments `revision`, and Postgres re-checks the `WHERE` clause after taking the row lock. Concurrent saves from any number of serverless instances therefore apply one at a time against the current row.

- **Withdrawals** (`{withdraw:[purposes]}`) always apply. They change the revision only when something actually changes.
- **Grants** (`{choices, expectedVersion}`) apply only if the visitor was shown the current revision, or if they add no grant to the current row. A refused request still applies its declines and returns 409.
- **Under GPC**, advertising and sale or sharing can never be newly granted (422).
- **Responses carry no consent state and set no cookies.** A late or replayed response cannot change anything. A late or replayed *request* is judged against the current row, so an old grant is refused and an old withdrawal can only withdraw.
- **Pages read `GET /api/privacy` after every save.**

**Identity.** The page creates the token with `crypto.getRandomValues` the first time the visitor saves, and stores it in the `__Host-iqon_privacy_id` cookie (Secure, SameSite=Lax, 400 days, renewed on each visit). The server never sets this cookie, so no delayed response can replace it. If two first tabs create one at the same moment, the browser keeps one, and every later request uses it. A withdrawal sent under the losing token stays pending until the ledger, read with the kept token, shows it.

The token is readable by page scripts because the page creates it. It only identifies an anonymous consent row and grants no other access. A visitor who deletes it starts over as unknown; that is their own action, not a race.

**Pending withdrawals.**
- **Where they live:** a withdrawal is written at once to `__Host-iqon_privacy_pending_<purpose>` cookies.
- **Who honors them:** every tab reads these cookies before checkout, and the server also reads them on every checkout request, so they hold even when page storage is full or a tab's JavaScript missed every notification.
- **When they clear:** only when the ledger shows the withdrawal, or when the visitor grants that purpose again from a form that showed it. Removal is compare and remove, so a newer withdrawal from another tab survives.
- **Notification and retry:** BroadcastChannel and storage events tell other tabs. Any tab retries on load, every 20 seconds after a failure, when the page becomes visible and when the browser comes back online.
- **If the browser refuses the cookie:** the withdrawal is kept in that tab only, and the message says so.

**The open form.** The form keeps the version it was filled from and always saves against it. If the decision changes elsewhere, its switches reset and it says so.

**Checkout.**
- **What it reads:** every checkout reads the ledger, applies pending cookies, page withdrawals and GPC, and runs a new `@inContext(visitorConsent: ...)` cart read.
- **Version binding:** if the page's version differs from the saved one, it gets 409 and no link.
- **The returned link:** Shopify's `checkoutUrl`, including `_cs`, is returned unchanged and never logged or cached.

## When the ledger is unavailable

Unavailable means the database is down, the variable is unset, the migration was not applied, or the role lacks permission.

- **Visitors who never saved a choice** have no identity cookie and need no database read. Their checkout is unchanged.
- **Visitors who made a choice** (they have the identity cookie, which is only created when the visitor saves in the panel):
  - The panel says their choices could not be loaded and keeps the last choices it had read, marked unavailable.
  - Saving fails visibly, and withdrawals stay pending and are retried.
  - At checkout, **all four purposes** are sent as declined, so no saved decline can fall back to regional defaults.
  - Checkout continues. Nothing is ever reported as granted because of an outage.
- **Identity without a stored row:** if a visitor's very first save never reached the ledger, the identity exists without a row, and an outage cannot tell the two cases apart. Such a visitor did make a choice in the panel, so they are treated the same way.

## Retention, migration and rollback

- **Retention:** rows not changed for 400 days are deleted, up to 50 after each save. The identity cookie also lapses after 400 days without a visit.
- **Migration:** additive, one table and one index. The application role needs SELECT, INSERT, UPDATE and DELETE on it.
- **Rollback:**
  1. Redeploy the previous storefront.
  2. Run `DROP TABLE "storefront_privacy_consents";`.

  This only discards anonymous consent rows. Browser cookies left behind are inert.
- **Earlier cookie protocols:** the earlier cookie based protocols on this branch were never deployed, so there is no data migration.

## Boundary

- **Same visitor's own requests:** the ledger orders requests correctly. It cannot tell a visitor's own crafted request from their browser's: a request that names the current version is that visitor's choice.
- **Cross site requests are rejected** (exact Origin, JSON only). `__Host-` cookies cannot be planted by sibling subdomains.
- **The Customer Privacy API is not loaded.** Its headless cookie sharing needs checkout on the storefront's root domain.
- **Shopify's opt out form keeps its own record,** and changes made inside hosted checkout do not come back to this site.
- **Not yet verified:** whether Shopify's hosted web checkout enforces `_cs`.

## Integration points

These are for the account surface:
- `usePrivacy(initial)`, `PrivacyChoicesSheet` and `PrivacyLinks` in `app/privacy-choices.tsx`
- `initialPrivacySnapshot()` and `privacyLinks()` in `lib/privacy.server.ts`, for the first render, with no database read
- `GET` and `POST /api/privacy`, with the body shapes above
- `readPrivacyState()` for server reads

`PrivacySnapshot.status` is `ready`, `loading` or `unavailable`. Snapshots are anonymous and keyed to the browser. Linking them to a signed in account is not part of this change.

## Tests

`scripts/privacy-test-db.sh` creates a fresh, owned, loopback-only PostgreSQL cluster. It applies the committed migration, exports `PRIVACY_TEST_DATABASE_URL`, runs the command, then removes only its own directory.

- `scripts/privacy-test-db.sh node --test tests/privacy-ledger.test.mjs tests/privacy.test.mjs tests/privacy-hook.test.mjs`: SQL ordering with several clients, the routes, and the real hook in jsdom.
- `node --test tests/cart-routes.test.mjs`: checkout handoff.
- `npm run build:vercel`, then `PLAYWRIGHT_CORE=<playwright-core> scripts/privacy-test-db.sh node --test --test-concurrency=1 tests/e2e/privacy.e2e.mjs`: the production build in Chromium at 1440×900 and 390×844, with the ledger on the owned cluster and a local Shopify fixture.
