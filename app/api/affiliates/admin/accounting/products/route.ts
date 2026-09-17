import { mergePendingProducts } from "@/lib/accounting/pending-products";
import {
  createPendingProduct,
  listUnmatchedPendingProducts,
  reconcileSyntheticItems,
} from "@/lib/accounting/store";
import { getProducts } from "@/lib/portal-commerce";
import { isNextResponse, requireAdminSession } from "@/lib/affiliates/auth-guards";
import { apiError, apiSuccess } from "@/lib/affiliates/api-response";
import { enforceRateLimit } from "@/lib/affiliates/rate-limit";

export const runtime = "nodejs";

/**
 * Product picker for recording inventory purchases. Loading it also links any
 * placeholder items to products that have since gone live in Shopify, so
 * stock recorded before launch carries over and Shopify sales start deducting
 * automatically.
 */
export async function GET() {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;

    const shopify = await getProducts({ per_page: 100 });
    const shopifyList = shopify.map((p) => ({ id: p.id, name: p.name, price: p.price }));

    let reconciled: { from: number; to: number; name: string }[] = [];
    try {
      const result = await reconcileSyntheticItems(shopifyList);
      reconciled = result.remapped;
    } catch (err) {
      console.error("[api/accounting/products] reconcile failed", err);
    }

    const customPending = await listUnmatchedPendingProducts();
    const products = mergePendingProducts(
      shopifyList,
      customPending.map((p) => ({ id: p.syntheticId, name: p.name }))
    );
    return apiSuccess({ products, reconciled });
  } catch (err) {
    console.error("[api/affiliates/admin/accounting/products GET]", err);
    return apiError("INTERNAL", "Failed to load products.", 500);
  }
}

/** Add a placeholder product that isn't in Shopify yet. */
export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    if (isNextResponse(session)) return session;
    const rate = await enforceRateLimit(request, "affiliates-admin-mutation", 60, 60_000);
    if (!rate.allowed) return apiError("RATE_LIMITED", "Too many requests.", 429);

    const body = (await request.json().catch(() => ({}))) as { name?: unknown };
    const result = await createPendingProduct(String(body.name ?? ""));
    if ("error" in result) {
      return apiError("VALIDATION_ERROR", result.error, 400);
    }
    return apiSuccess({ product: result });
  } catch (err) {
    console.error("[api/affiliates/admin/accounting/products POST]", err);
    return apiError("INTERNAL", "Failed to add product.", 500);
  }
}
