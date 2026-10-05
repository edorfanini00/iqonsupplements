# IQON order emails (order confirmation and shipping confirmation)

Customer transactional emails for the IQON supplements storefront (www.iqonbody.com), sent through Resend from Shopify webhooks.

* **Order confirmation**: one per paid order (`orders/paid`).
* **Shipping confirmation**: one per fulfilment, once it carries tracking (`fulfillments/create`, `fulfillments/update`).

Previews: [`docs/emails/`](emails/) (HTML, plain text and PNG screenshots at 390px, 1280px and 390px dark mode).

## Architecture

```
Shopify (hosted checkout creates the order; Supliful adds fulfilments + tracking)
   │  webhook: orders/paid, fulfillments/create, fulfillments/update
   ▼
POST /api/webhooks/shopify/orders          app/api/webhooks/shopify/orders/route.ts
   │  readLimitedBody (1 MB cap) → handleShopifyOrderWebhook (lib/orders/webhooks/handler.ts)
   │   1. x-shopify-shop-domain must be nr9zd0-t5.myshopify.com (SUPPLEMENTS_SHOP)
   │   2. HMAC SHA256 over the raw body with SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET (timing safe)
   │   3. topic allowlist; anything else → 200 {ignored}
   │   4. parse payload (lib/orders/webhooks/shopify-payload.ts)
   │   5. best effort enrichment, in parallel, inside the budget:
   │        Storefront API product images (lib/orders/emails/images.ts)
   │        Admin API order read for subscription names / missing recipient (admin-order.ts)
   │   6. durable claim in supplements_transactional_emails (store.ts)
   │   7. render (lib/orders/emails/*) and send via Resend with an idempotency key (sender.ts)
   │   8. record sent / failed / skipped
   ▼
Resend → customer
```

The route lives outside `/api/affiliates` (relayed to Health by `proxy.ts`) and `/api/cron`, and does not touch affiliate ingestion. Runtime `nodejs`, `force-dynamic`.

### Idempotency

Table `supplements_transactional_emails`, unique on `(kind, dedupe_key)`:

| kind | dedupe_key | Resend idempotency key |
| --- | --- | --- |
| `order_confirmation` | Shopify order id | `order-confirmation/<orderId>` |
| `shipping_confirmation` | Shopify fulfilment id | `shipped/<fulfillmentId>` |

* A claim is an `INSERT` (wins once thanks to the unique index) or a single conditional `UPDATE` that takes over a row that is `failed` or `sending` for longer than 5 minutes (stale). Postgres re-evaluates the `WHERE` under the row lock, so exactly one concurrent delivery wins. Proven against a real Postgres in `tests/orders/store.integration.test.ts`.
* Each claim gets a random `claim_token`; only the holder can mark the row `sent`/`failed`/`skipped`.
* `sent` and `skipped` are terminal. A later tracking number change on the same fulfilment therefore never sends a second email.
* Resend's idempotency key (24h window) covers the gap where the email went out but our `sent` update was lost (crash or timeout). If Resend reports `invalid_idempotent_request` (same key, different body) we treat it as already sent.
* Fulfilments that are not ready (no tracking yet, `pending`, `cancelled`, `error`, `failure`) are acknowledged **without** writing a row, so the later `fulfillments/update` that adds tracking can still send.

### Response contract

| Status | When | Shopify behaviour |
| --- | --- | --- |
| 200 | sent; duplicate of a sent/skipped email; deliberate skip (no recipient, not ready, cancelled); unknown topic; permanent Resend rejection (validation errors) | done |
| 401 | wrong shop domain or bad HMAC | retried, then dropped |
| 400 / 413 | unreadable JSON / body over 1 MB | retried, then dropped |
| 503 | not configured (secret, DB or Resend missing); transient failure (claim released as `failed`); another delivery currently holds a fresh claim | retried with backoff |

Unknown topics return 200 so a mis-subscribed topic does not keep failing. Budget is about 4s end to end (Shopify waits 5s): enrichment ≤1.3s in parallel, claim ≤1.5s, Resend send gets the rest; a hung Resend call is cut off and released.

### Data stored (minimal PII)

`snapshot` on the `order_confirmation` row: order id/name, contact email, first name, currency, test flag, line items (title, variant, quantity, price, selling plan name, image URL), totals, discount codes, shipping address, Shopify order status URL. No payment, billing address, phone, IP or browser data. Shipping rows store only `{lineItems:[{id,quantity}]}` to detect partial shipments. Logs mask emails (`a***@example.com`) and never include secrets. Follow up (not in this PR): a retention job that nulls `snapshot` after e.g. 90 days.

### Content rules

* Brand: "IQON", palette and type from `app/globals.css` (ink #242526, paper #fbfcfd, Lora headings, Inter body). Header wordmark is `public/images/email/iqon-wordmark-ink.png` (white on ink, opaque, so it survives dark mode inversion).
* No dash characters in customer copy, no health or medical claims. Enforced by `tests/orders/templates.test.ts`.
* "Shipping usually takes 3 to 5 business days" matches the storefront help page ("Shipping takes 3–5 business days").
* Partial shipments list only that fulfilment's items and add: "This parcel holds part of your order. The rest will follow in a separate shipment…".
* Tracking button uses Shopify's `tracking_url` when it is https, otherwise the universal tracker already used by `lib/orders/tracking.ts` (parcelsapp).
* Product images: Storefront API (variant image, else product featured image, requested as 240×300 JPG), else `public/images/email/products/<handle>.jpg` matched by handle or title, else `placeholder.jpg`. All absolute https URLs built from `SUPPLEMENTS_EMAIL_ASSET_ORIGIN`.
* Support address: `SUPPLEMENTS_SUPPORT_EMAIL`, default `support@iqonsupplements.com` (the support address documented by the existing contact reply mailer, `lib/contact/reply-mailer.ts`). It is also set as Reply-To. **Open decision:** confirm this inbox exists and is monitored, or set the env var.

## Environment variables

| Name | Purpose | In Vercel today |
| --- | --- | --- |
| `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` | HMAC key for webhook verification (see registration below for which value) | **No** (required) |
| `SUPPLEMENTS_RESEND_API_KEY` | Resend API key (shared with the other supplements mailers) | **No** (required) |
| `SUPPLEMENTS_EMAIL_FROM` | Default From for supplements mail, e.g. `IQON <orders@iqonbody.com>` | **No** (required unless the override is set) |
| `SUPPLEMENTS_ORDER_EMAIL_FROM` | Optional From override for order emails only; falls back to `SUPPLEMENTS_EMAIL_FROM` | No (optional) |
| `SUPPLEMENTS_DATABASE_URL` | Postgres for the idempotency ledger (Prisma) | **No** (required; route fails closed with 503 without it) |
| `SUPPLEMENTS_SUPPORT_EMAIL` | Support address shown in emails and used as Reply-To | No (optional, default above) |
| `SUPPLEMENTS_EMAIL_ASSET_ORIGIN` | https origin for email images and links, default `https://www.iqonbody.com` | No (optional) |
| `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_PRIVATE_TOKEN`, `SHOPIFY_API_VERSION` | Storefront API image lookup (existing) | Yes |
| `SUPPLEMENTS_SHOPIFY_CLIENT_ID`, `SUPPLEMENTS_SHOPIFY_CLIENT_SECRET`, `SUPPLEMENTS_SHOPIFY_STORE_DOMAIN` | Optional Admin API order read (existing client) | Yes (Production only) |
| `SUPPLEMENTS_SHOPIFY_ADMIN_TOKEN` | Alternative Admin auth (existing) | No (optional) |

**Sender domain:** production needs a Resend verified domain for the From address (for example `iqonbody.com`). The preview test sends used `IQON <orders@iqonhealth.com>` because that is the only verified domain on the Resend account used for testing; do not use it for production without a decision.

The Admin read uses fields covered by protected customer data (email, shipping address). If the app lacks that access, the lookup fails and the email still sends from the webhook payload/snapshot.

## Go live checklist (owner approval required, in this order)

1. **Database**: provision Postgres, set `SUPPLEMENTS_DATABASE_URL` in Vercel, then apply the migration:
   `SUPPLEMENTS_DATABASE_URL=... npx prisma migrate deploy`
   (applies `prisma/migrations/20261005000000_supplements_transactional_emails`, additive: one new table and two indexes). If the database was created outside Prisma migrations, apply that one `migration.sql` directly instead.
2. **Resend**: verify the sending domain, set `SUPPLEMENTS_RESEND_API_KEY` and `SUPPLEMENTS_EMAIL_FROM` (or `SUPPLEMENTS_ORDER_EMAIL_FROM`); optionally `SUPPLEMENTS_SUPPORT_EMAIL`.
3. **Deploy** this branch (it also ships `public/images/email/*`, which the emails reference).
4. **Register webhooks** (step below) and set `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` to the matching signing secret, then redeploy so the env var is live.
5. **Turn off Shopify's own customer notifications** (below) so customers do not get two emails.
6. Place a Shopify **test order** (test orders send normally and are flagged `test_order` in logs), then fulfil it with tracking. Check the inbox and the table:
   `select kind, dedupe_key, status, attempts, resend_message_id, last_error from supplements_transactional_emails order by created_at desc limit 20;`

### Registering the webhooks

Endpoint: `https://www.iqonbody.com/api/webhooks/shopify/orders` (one route, three topics).

**Option A: app subscription (recommended).** Signed with the **app client secret** (`SUPPLEMENTS_SHOPIFY_CLIENT_SECRET`), so set `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` to that value. Run once per topic via the Admin GraphQL API with the supplements app:

```graphql
mutation Subscribe($topic: WebhookSubscriptionTopic!) {
  webhookSubscriptionCreate(
    topic: $topic
    webhookSubscription: { callbackUrl: "https://www.iqonbody.com/api/webhooks/shopify/orders", format: JSON }
  ) {
    webhookSubscription { id topic }
    userErrors { field message }
  }
}
```

with `$topic` = `ORDERS_PAID`, `FULFILLMENTS_CREATE`, `FULFILLMENTS_UPDATE`. (Newer API versions use `uri` instead of `callbackUrl` inside `webhookSubscription`; use whichever the configured `SHOPIFY_API_VERSION` accepts.) The app needs `read_orders` (and `read_fulfillments` / `read_merchant_managed_fulfillment_orders` or `read_assigned_fulfillment_orders` as Shopify requires for fulfilment topics).

**Option B: Shopify admin.** Settings > Notifications > Webhooks > Create webhook, format JSON, same URL, events "Order payment", "Fulfillment creation", "Fulfillment update". Admin created webhooks are signed with the **store's webhook signing key** shown on that page ("Your webhooks will be signed with …"), so set `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` to that key, not the app secret. Use one option, not both, or customers would still get one email (ledger dedupes) but you would be paying for double deliveries.

### Avoid duplicate customer emails

Orders come from Shopify hosted checkout, so Shopify's own notifications are on by default. In Shopify admin: **Settings > Notifications > Customer notifications**:

* Order processing: **Order confirmation**
* Shipping: **Shipping confirmation**, **Shipping update**, **Out for delivery**, **Delivered**

Shipping notifications can be switched off individually. Shopify does not let every plan fully disable the **Order confirmation** email; check the toggle on this store. If it cannot be disabled, either keep Shopify's confirmation and skip ours (unregister `orders/paid` only, shipping emails keep working because they read the order data from the fulfilment payload and the Admin API), or reduce Shopify's template to a minimal note. This is an owner decision.

**Supliful:** confirm in the Supliful app settings that Supliful does not email end customers itself (shipping/tracking notifications). If it does, disable them there.

### Rollback

* Fast: delete the three webhook subscriptions (`webhookSubscriptionDelete(id:)`, or remove them in Settings > Notifications > Webhooks) **or** unset `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` (route returns 503; Shopify retries then gives up, and app subscriptions may be removed after repeated failures). Re-enable Shopify's customer notifications.
* Code: revert the merge commit. The table is additive and can stay; to remove it: `DROP TABLE "supplements_transactional_emails";`.

## Tests and tools

```
npm run test:order-emails                     # unit tests; DB tests skip
ORDER_EMAILS_TEST_DATABASE_URL=postgresql://... npm run test:order-emails   # + real Postgres concurrency tests (drops/recreates the table!)
node --import tsx scripts/render-order-email-previews.ts --out docs/emails [--screenshots --asset-origin http://127.0.0.1:8765]
RESEND_API_KEY=... node --import tsx scripts/send-order-email-preview.ts [--asset-base https://...]   # owner inbox only
```

Screenshots: `CHROME_PATH` can point at Playwright's `chrome-headless-shell` (desktop Chrome's `--screenshot` sometimes does not exit). Serve `public/` locally (`python3 -m http.server 8765` in `public/`) so images load before deploy.

## Known limitations

* Partial shipment detection compares the fulfilment with the order snapshot and earlier shipping emails. Two fulfilments of one order that arrive at the same instant may both say "the rest will follow".
* Subscription labels come from the webhook when present, otherwise from the Admin API. Without Admin access, a subscription line shows without its label.
* Subscription renewal orders also trigger `orders/paid`, so each renewal gets an order confirmation. Owner decision whether that is wanted.
* Prices in the confirmation use Shopify's `current_*` totals (after edits/refunds at the time of payment) in the presentment currency.
