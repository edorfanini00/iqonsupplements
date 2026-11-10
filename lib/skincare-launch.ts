import identity from "./skincare-launch-identity.json";
import { activeSkincareIds, isActiveSkincareHandle } from "./skincare-identity";

/** S8939 conditional launch. A skincare handle leaves "Coming soon" ONLY when:
 *  - it is one of the exact eight active handles (legacy handles never qualify);
 *  - the committed identity binds it to an exact store + product + variant GID;
 *  - the configured Storefront store is that exact store;
 *  - a FRESH Storefront read returns that exact variant on that exact product/handle
 *    (Storefront only returns ACTIVE products published to this channel), tagged
 *    iqon-skincare (and not iqon-supplements), available, one-time only, at the
 *    exact approved USD price, with a positive integer quantityAvailable.
 * Anything else — unconfigured, empty, outage, missing variant, wrong store, id
 * collision, price drift, no stock metadata, zero stock — keeps it held. There is
 * no nominal-stock fallback: an unknown quantity is never purchasable. */

export type LaunchIdentity = {
  store: string; currency: string;
  products: { handle: string; supplierSku: string; approvedPriceUsd: string; productId: string | null; variantId: string | null }[];
};
export type LaunchBinding = { handle: string; productId: string; variantId: string; priceCents: number };
export type QualifiedSkincare = { handle: string; productId: string; variantId: string; title: string; price: number; currency: "USD"; quantityAvailable: number };
export type SkincareQualification = { status: "ok" | "unavailable"; qualified: ReadonlyMap<string, QualifiedSkincare> };

export const COMMITTED_LAUNCH_IDENTITY = identity as LaunchIdentity;
const GID = (kind: string) => new RegExp(`^gid://shopify/${kind}/[1-9][0-9]{0,19}$`);
const CENTS = /^(0|[1-9][0-9]{0,6})\.[0-9]{2}$/;
const toCents = (v: string) => { const [a, b] = v.split("."); return Number(a) * 100 + Number(b); };

/** Complete, collision-free bindings for the configured store; empty on any doubt. */
export function launchBindings(domain: string | null | undefined, config: LaunchIdentity = COMMITTED_LAUNCH_IDENTITY): LaunchBinding[] {
  if (!domain || config.store !== domain || config.currency !== "USD") return [];
  const complete = config.products.filter(p => isActiveSkincareHandle(p.handle)
    && typeof p.productId === "string" && GID("Product").test(p.productId)
    && typeof p.variantId === "string" && GID("ProductVariant").test(p.variantId)
    && typeof p.approvedPriceUsd === "string" && CENTS.test(p.approvedPriceUsd) && toCents(p.approvedPriceUsd) > 0);
  // Any id or handle used twice disqualifies every entry that shares it.
  const count = (key: (p: typeof complete[number]) => string) => complete.reduce((m, p) => m.set(key(p), (m.get(key(p)) ?? 0) + 1), new Map<string, number>());
  const variants = count(p => p.variantId!), productIds = count(p => p.productId!), handles = count(p => p.handle);
  return complete.filter(p => variants.get(p.variantId!) === 1 && productIds.get(p.productId!) === 1 && handles.get(p.handle) === 1)
    .map(p => ({ handle: p.handle, productId: p.productId!, variantId: p.variantId!, priceCents: toCents(p.approvedPriceUsd) }));
}

export const SKINCARE_QUALIFICATION_QUERY = `query IQONSkincareQualification($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on ProductVariant {
      id title availableForSale currentlyNotInStock quantityAvailable
      price { amount currencyCode }
      product { id handle tags availableForSale requiresSellingPlan }
    }
  }
}`;

export type QualificationNode = {
  id: string; title: string; availableForSale: boolean; currentlyNotInStock: boolean; quantityAvailable: number | null;
  price: { amount: string; currencyCode: string };
  product: { id: string; handle: string; tags: string[]; availableForSale: boolean; requiresSellingPlan: boolean };
} | null;

export const NO_QUALIFICATION: SkincareQualification = { status: "ok", qualified: new Map() };
export const UNAVAILABLE_QUALIFICATION: SkincareQualification = { status: "unavailable", qualified: new Map() };

/** Pure qualification of a fresh nodes() response against the bindings.
 * `foreignVariantIds` are variant ids seen on any OTHER catalog product: a
 * collision with them holds the skincare entry. */
export function qualifySkincare(bindings: LaunchBinding[], nodes: unknown, foreignVariantIds: ReadonlySet<string> = new Set()): SkincareQualification {
  if (!Array.isArray(nodes) || nodes.length !== bindings.length) return UNAVAILABLE_QUALIFICATION;
  const qualified = new Map<string, QualifiedSkincare>();
  bindings.forEach((b, i) => {
    const n = nodes[i] as QualificationNode;
    if (!n || n.id !== b.variantId || foreignVariantIds.has(b.variantId)) return;
    const p = n.product;
    if (!p || p.id !== b.productId || p.handle !== b.handle) return;
    if (!Array.isArray(p.tags) || !p.tags.includes("iqon-skincare") || p.tags.includes("iqon-supplements")) return;
    if (p.availableForSale !== true || n.availableForSale !== true || n.currentlyNotInStock !== false || p.requiresSellingPlan !== false) return;
    if (n.price?.currencyCode !== "USD" || typeof n.price.amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(n.price.amount)) return;
    const cents = Math.round(Number(n.price.amount) * 100);
    if (cents !== b.priceCents) return;
    if (!Number.isSafeInteger(n.quantityAvailable) || (n.quantityAvailable as number) <= 0) return;
    qualified.set(b.handle, { handle: b.handle, productId: b.productId, variantId: b.variantId, title: String(n.title || ""), price: cents / 100, currency: "USD", quantityAvailable: n.quantityAvailable as number });
  });
  return { status: "ok", qualified };
}

/** A cart/checkout line may proceed only when it is the exact qualified variant
 * of its exact handle and carries no selling plan. */
export function isQualifiedLine(q: SkincareQualification, line: { merchandise: { id: string; product: { handle: string } }; sellingPlanAllocation?: unknown }) {
  const entry = q.qualified.get(line.merchandise.product.handle);
  return !!entry && entry.variantId === line.merchandise.id && !line.sellingPlanAllocation;
}
export { activeSkincareIds };
