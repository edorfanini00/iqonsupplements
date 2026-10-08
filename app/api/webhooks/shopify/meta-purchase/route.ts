/**
 * Shopify orders/paid webhook -> Meta Conversions API Purchase.
 * Sends nothing but the Meta event: no email, no database, no affiliate
 * ingestion. Kept apart from ../orders (order emails) on purpose.
 * See lib/analytics/meta-purchase.ts and docs/meta-pixel.md.
 */
import { handleMetaPurchaseWebhook } from "@/lib/analytics/meta-purchase";
import { readLimitedBody } from "@/lib/analytics/meta-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const read = await readLimitedBody(request);
  if (!read.ok) return Response.json({ ok: false, reason: read.reason }, { status: read.status, headers });
  const result = await handleMetaPurchaseWebhook(read.body, request.headers, { env: process.env });
  return Response.json(result.body, { status: result.status, headers });
}
