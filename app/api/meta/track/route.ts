/**
 * Meta Conversions API relay for browser pixel events (PageView, ViewContent,
 * AddToCart, InitiateCheckout). Same event_id as the browser copy; Purchase is
 * not accepted here (it comes from the Shopify orders/paid webhook).
 */
import { handleRelay } from "@/lib/analytics/meta-relay";
import { resolvePixelId } from "@/lib/analytics/meta-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Diagnostic: is the token loaded? Never returns any part of it. */
export function GET() {
  return Response.json({
    relayEnabled: false,
    purchaseProductionEnabled: false,
    tokenSet: Boolean(process.env.META_CAPI_ACCESS_TOKEN?.trim()),
    pixelId: resolvePixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID),
  }, { headers });
}

export async function POST(request: Request) {
  const result = await handleRelay(request);
  return result.body ? Response.json(result.body, { status: result.status, headers }) : new Response(null, { status: result.status, headers });
}
