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
   │  readLimitedBody (raw bytes, 1 MB cap, 2s read deadline) → handleShopifyOrderWebhook (lib/orders/webhooks/handler.ts)
   │   1. x-shopify-shop-domain must be nr9zd0-t5.myshopify.com (SUPPLEMENTS_SHOP)
   │   2. HMAC SHA256 over the raw body with SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET (timing safe)
   │   3. topic allowlist; anything else → 200 {ignored}
   │   4. parse payload (lib/orders/webhooks/shopify-payload.ts)
   │   5. best effort enrichment, in parallel, inside the budget:
   │        Storefront API product images (lib/orders/emails/images.ts)
   │        Admin API order read for subscription names / missing recipient (admin-order.ts)
   │   6. durable claim in supplements_transactional_emails (store.ts)
   │   7. render (lib/orders/emails/*) and send via Resend with an idempotency key (sender.ts)
   │   8. record sent / failed / skipped (every ledger write is time bounded)
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

* A claim is an `INSERT` (wins once thanks to the unique index) or a conditional `UPDATE` that takes over a row that is `failed` or `sending` for longer than 5 minutes (stale). Postgres re-evaluates the `WHERE` under the row lock, so exactly one concurrent delivery wins. Proven against a real Postgres in `tests/orders/store.integration.test.ts`.
* Each claim gets a random `claim_token`; only the holder can mark the row `sent`/`failed`/`skipped`.
* `sent`, `skipped` and `sent_unconfirmed` are terminal. A later tracking number change or `shipment_status` update (`in_transit`, `out_for_delivery`, `delivered`) on the same fulfilment therefore never sends a second email.
* **Uncertain sends and the 24h Resend window.** Resend remembers an idempotency key for 24 hours. If an attempt may have reached Resend without a confirmed outcome (our `sent` update was lost, the call timed out, a network error, a Resend 5xx), the row gets `send_uncertain = true` (sticky, never cleared). Such a row is retried only within **23 hours of its first claim** (`created_at`), where the same key makes the retry a no-op at Resend. After that, the next delivery turns it into the terminal `sent_unconfirmed` (`last_error = ambiguous_send_expired`) and gets a 200 duplicate. The email was probably delivered, and a second "on its way" email days later is worse than a missing one. Failures Resend explicitly refused (4xx such as rate limit or a bad key) are not uncertain and stay retryable.
* After a successful send, `markSent` gets about 1s of reserved budget and is tried twice.
* A retry renders from the snapshot stored by the first claim (order snapshot, or the shipment render input), so Resend sees the same body for the same key. If Resend still reports `invalid_idempotent_request` (same key, different body), we treat it as already sent.
* Fulfilments that are not ready (no tracking yet, `pending`, `cancelled`, `error`, `failure`) are acknowledged **without** writing a row, so the later `fulfillments/update` that adds tracking can still send.

### Response contract

| Status | When | Shopify behaviour |
| --- | --- | --- |
| 200 | sent; duplicate of a sent/skipped/sent_unconfirmed email; deliberate skip (no recipient, not ready, cancelled); unknown topic; permanent Resend rejection of this message (payload validation errors) | done |
| 401 | wrong shop domain or bad HMAC | retried, then dropped |
| 400 / 408 / 413 | unreadable JSON / body not received within 2s / body over 1 MB | retried, then dropped |
| 503 | not configured (secret, DB or Resend missing); Resend setup problem (invalid or restricted API key, unverified From domain (a 403 `validation_error`), quota, rate limit); transient failure (claim released as `failed`); another delivery currently holds a fresh claim | retried with backoff |

Every non 2xx counts toward Shopify's failure limit: Shopify retries a failed delivery 8 times over about 4 hours, and **app subscriptions that keep failing are removed** (Shopify emails the app's contact). So configuration must be in place before the webhooks are registered (go live order below), and a 503 caused by a misconfigured Resend domain must be fixed quickly.

Unknown topics return 200 so a mis-subscribed topic does not keep failing. Budget is about 4s end to end (Shopify waits 5s): enrichment ≤1.3s in parallel, claim ≤1.5s, Resend send gets the rest; a hung Resend call is cut off and released.

### Data stored (minimal PII)

`snapshot` on the `order_confirmation` row: order id/name, contact email, first name, currency, test flag, line items (title, variant, quantity, price, selling plan name, image URL), totals, discount codes, shipping address, Shopify order status URL. No payment, billing address, phone, IP or browser data. Shipping rows store `{lineItems:[{id,quantity}], shipment}`: the ids and quantities detect partial shipments, and `shipment` is the exact render input (recipient email, first name, carrier, tracking, items, delivery address) so a retry sends an identical body. Logs mask emails (`a***@example.com`) and never include secrets. Follow up (not in this PR): a retention job that nulls `snapshot` after e.g. 90 days.

### Content rules

* Brand: "IQON", palette and type from `app/globals.css` (ink #242526, paper #fbfcfd, Lora headings, Inter body). Header wordmark is `public/images/email/iqon-wordmark-ink.png` (white on ink, opaque, so it survives dark mode inversion).
* No dash characters in customer copy, no health or medical claims. Enforced by `tests/orders/templates.test.ts`.
* "Shipping usually takes 3 to 5 business days" matches the storefront help page ("Shipping takes 3–5 business days").
* Partial shipments list only that fulfilment's items and add: "This parcel holds part of your order. The rest will follow in a separate shipment…".
* Tracking button reuses `resolveTrackingUrl` from `lib/orders/tracking.ts`, so the email and the storefront agree: the universal tracker keyed on the number (parcelsapp; carrier pages such as USPS stall on anti bot interstitials), otherwise Shopify's `tracking_url` when it is https.
* Totals: Subtotal is the **pre discount** line sum at current quantities (Shopify's `subtotal_price` is already after discounts, so it is not used), Discount is `current_total_discounts` (line, order and shipping discounts), Shipping is `total_shipping_price_set` (before shipping discounts), Tax is `current_total_tax`, Total is `current_total_price`. Subtotal minus discounts plus shipping plus tax (unless `taxes_included`) equals the total; tested in `tests/orders/templates.test.ts`. If a real order does not add up (for example a tip or duties, which the email does not itemise), the handler logs `totals_mismatch` with the difference and still sends.
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

Configure everything first, deploy, and only then register the webhooks. A webhook that lands on a half configured deployment gets 503s, and repeated failures can get the subscription removed.

1. **Database**: provision Postgres, set `SUPPLEMENTS_DATABASE_URL` in Vercel, then apply the migrations:
   `SUPPLEMENTS_DATABASE_URL=... npx prisma migrate deploy`
   (applies `20261005000000_supplements_transactional_emails` (one new table and two indexes) and `20261006000000_transactional_emails_send_uncertain` (one new boolean column); both additive). If the database was created outside Prisma migrations, apply the two `migration.sql` files directly, in order.
2. **Resend**: verify the sending domain, then set `SUPPLEMENTS_RESEND_API_KEY` and `SUPPLEMENTS_EMAIL_FROM` (or `SUPPLEMENTS_ORDER_EMAIL_FROM`), and optionally `SUPPLEMENTS_SUPPORT_EMAIL`.
3. **Webhook secret**: set `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET`. For Option A (app subscription) the value is known in advance: the app client secret. For Option B (admin webhooks), the signing key is shown on Settings > Notifications > Webhooks. Verify in admin whether it is visible before the first webhook exists. If it is not, create the webhooks, then immediately set the key and redeploy; deliveries in that short window get a 503 and are retried by Shopify.
4. **Deploy** this branch. It also ships `public/images/email/*`, which the emails reference. Check that `https://www.iqonbody.com/images/email/iqon-wordmark-ink.png` returns 200.
5. **Register the webhooks** (below).
6. **Handle Shopify's own customer notifications and Supliful's** (below), so customers do not get two emails.
7. **Test order**: place a Shopify test order **with a discount code** (test orders send normally and are flagged `test_order` in logs), then fulfil it with tracking. Check:
   * Exactly one IQON confirmation and one IQON shipping email arrived, and **no Shopify or Supliful confirmation or shipping email** arrived for the same order.
   * The confirmation totals match the order page in Shopify admin (subtotal, discount, shipping, tax, total), and the logs show no `totals_mismatch`.
   * The ledger is clean. Every row must be `sent`; any `failed` row means a configuration problem (look at `last_error`):
     `select kind, dedupe_key, status, attempts, send_uncertain, resend_message_id, last_error from supplements_transactional_emails order by created_at desc limit 20;`
   * Afterwards, monitor the logs for `send_failed`, `mark_sent_failed` and `totals_mismatch` (for example a Vercel log alert), and occasionally run `select status, count(*) from supplements_transactional_emails group by 1;`. A `sent_unconfirmed` count above zero means a send could not be confirmed. The customer most likely got the email; check the Resend dashboard.

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

Orders come from Shopify hosted checkout, so Shopify's own customer notifications are active. Shopify does **not** offer an on/off toggle for every notification, so verify each of these in admin (**Settings > Notifications > Customer notifications**) instead of assuming:

* **Order confirmation**: generally cannot be switched off. Options: (a) keep Shopify's and do not use ours (do not subscribe `orders/paid`; the shipping emails still work from the fulfilment payload and the Admin API), or (b) keep ours and edit Shopify's "Order confirmation" template down to a minimal note. Owner decision.
* **Shipping confirmation**: generally has no global toggle either. Shopify sends it per fulfilment when the fulfilment is created with "notify customer" set, and here Supliful's app creates the fulfilments. Options, in order of preference: (a) configure Supliful not to notify the customer, if their app exposes that setting (ask Supliful support otherwise); (b) edit Shopify's "Shipping confirmation" template down to a minimal note, or decide to keep Shopify's shipping email and not subscribe the fulfilment topics.
* **Shipping update, Out for delivery, Delivered**: these do have toggles. Ours sends one email per fulfilment only, so switching them off removes later status emails. Owner decision whether to keep them.

**Supliful:** also check whether Supliful sends its own end customer emails (shipping or tracking). If it does, disable them there.

Go live step 7 is the proof: the test order must produce no Shopify or Supliful duplicate. Do not treat any of the above as settled until a test order has confirmed it.

### Rollback

* Fast: delete the three webhook subscriptions (`webhookSubscriptionDelete(id:)`, or remove them in Settings > Notifications > Webhooks) **or** unset `SUPPLEMENTS_SHOPIFY_WEBHOOK_SECRET` (route returns 503; Shopify retries then gives up, and app subscriptions may be removed after repeated failures). Re-enable Shopify's customer notifications.
* Code: revert the merge commit. The table and column are additive and can stay. To remove them: `DROP TABLE "supplements_transactional_emails";` (or just the column: `ALTER TABLE "supplements_transactional_emails" DROP COLUMN "send_uncertain";`).

## Tests and tools

```
npm run test:order-emails                     # unit tests; DB tests skip
ORDER_EMAILS_TEST_DATABASE_URL=postgresql://... npm run test:order-emails   # + real Postgres concurrency tests (drops/recreates the table!)
node --import tsx scripts/render-order-email-previews.ts --out docs/emails [--screenshots --asset-origin http://127.0.0.1:8765]
RESEND_API_KEY=... node --import tsx scripts/send-order-email-preview.ts [--asset-base https://...]   # owner inbox only
```

Screenshots: the script uses Playwright (exact viewport, full page, local Chrome) when `playwright-core` can be imported, either from the project or from `PLAYWRIGHT_CORE_PATH=/path/to/node_modules/playwright-core` (an npx cache copy works). Otherwise, or with `--chrome`, it runs plain headless Chrome with the email inside an iframe of the exact width, kills Chrome as soon as the PNG is written, and crops with `sips` (macOS). Serve `public/` locally (`python3 -m http.server 8765` in `public/`) so images load before deploy.

## Known limitations

* Partial shipment detection compares the fulfilment with the order snapshot and earlier shipping emails. Two fulfilments of one order that arrive at the same instant may both say "the rest will follow".
* Subscription labels come from the webhook when present, otherwise from the Admin API. Without Admin access, a subscription line shows without its label.
* Subscription renewal orders also trigger `orders/paid`, so each renewal gets an order confirmation. Owner decision whether that is wanted.
* Prices in the confirmation use Shopify's `current_*` totals (after edits/refunds at the time of payment) in the presentment currency. Tips and duties are not itemised (logged as `totals_mismatch`).
* "The rest will follow" relies on the snapshot taken at `orders/paid`. Items removed after payment, or a fulfilment that never got tracking, can make it wrong. Follow up: when Admin access is configured, read the remaining unfulfilled quantity at shipment time. Also confirm on the first real order that `fulfillable_quantity` in `fulfillments/create` reflects the post fulfilment value.
* Retention: `snapshot` keeps the email, first name and address indefinitely. Follow up ticket: null `snapshot` after about 90 days.
* A row whose send was uncertain and that is first retried more than 23h later is marked `sent_unconfirmed` without sending. In the rare case that the first attempt really did not deliver, the customer misses that one email (see monitoring in go live step 7).
