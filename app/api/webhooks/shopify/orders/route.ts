/**
 * Shopify webhook endpoint for IQON customer order emails.
 * Subscribed topics: orders/paid, fulfillments/create, fulfillments/update.
 * Lives outside /api/affiliates (relayed to Health) and /api/cron on purpose;
 * it never touches affiliate ingestion. See docs/order-emails.md.
 */
import { prisma } from "@/lib/db/prisma";
import { brandConfig } from "@/lib/orders/emails/format";
import { storefrontImageLookup } from "@/lib/orders/emails/images";
import { adminOrderLookup } from "@/lib/orders/webhooks/admin-order";
import { handleShopifyOrderWebhook, readLimitedBody } from "@/lib/orders/webhooks/handler";
import { resendSender } from "@/lib/orders/webhooks/sender";
import { prismaTransactionalEmailStore } from "@/lib/orders/webhooks/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const raw = await readLimitedBody(request);
  if (raw === null) return Response.json({ ok: false, reason: "too_large" }, { status: 413, headers });
  const env = process.env;
  const result = await handleShopifyOrderWebhook(raw, request.headers, {
    env,
    store: env.SUPPLEMENTS_DATABASE_URL?.trim() ? prismaTransactionalEmailStore(prisma) : null,
    sender: resendSender(env),
    imageLookup: storefrontImageLookup(env),
    adminOrderLookup: adminOrderLookup(),
    brand: brandConfig(env),
  });
  return Response.json(result.body, { status: result.status, headers });
}
