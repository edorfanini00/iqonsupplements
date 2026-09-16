/**
 * Shipment tracking extraction from Shopify order meta.
 *
 * EasyShip and other shipping plugins write tracking details onto the order as
 * meta_data once a label is purchased. The exact key/shape varies by plugin, so
 * we probe the common conventions (Shopify Shipment Tracking array + a set
 * of generic single-value keys) and normalize to a single shape.
 *
 * Shared by the customer order page (display) and the order webhook (shipped
 * notification + auto-complete), so both read tracking identically.
 */

import type { ShopifyOrder } from "@/types/portal-commerce";

export interface OrderTracking {
  number: string | null;
  provider: string | null;
  url: string | null;
}

type MetaList = NonNullable<ShopifyOrder["meta_data"]>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Pull normalized tracking from an order's meta. Returns null when no tracking
 * is present (i.e. a label has not been purchased yet).
 */
export function extractTracking(
  order: Pick<ShopifyOrder, "meta_data"> | null | undefined
): OrderTracking | null {
  const meta: MetaList | undefined = order?.meta_data ?? undefined;
  if (!meta?.length) return null;

  const byKey = (key: string) => meta.find((m) => m.key === key)?.value;
  const byKeyIncludes = (needle: string) =>
    meta.find((m) => m.key.toLowerCase().includes(needle))?.value;

  // 1) Shopify Shipment Tracking plugin (and variants) commonly store an
  //    array of shipments under this key.
  const shipmentItemsRaw = byKey("_wc_shipment_tracking_items");
  const shipmentItems = Array.isArray(shipmentItemsRaw)
    ? shipmentItemsRaw
    : typeof shipmentItemsRaw === "string"
      ? tryParseJson(shipmentItemsRaw)
      : null;

  if (Array.isArray(shipmentItems) && shipmentItems.length > 0) {
    const first = shipmentItems[0] as Record<string, unknown>;
    const number =
      asString(first.tracking_number) ??
      asString(first.trackingNumber) ??
      asString(first.number);
    const provider =
      asString(first.tracking_provider) ??
      asString(first.custom_tracking_provider) ??
      asString(first.trackingProvider) ??
      asString(first.provider);
    const url =
      asString(first.custom_tracking_link) ??
      asString(first.tracking_link) ??
      asString(first.tracking_url) ??
      asString(first.url);

    if (number || provider || url) return { number, provider, url };
  }

  // 2) Generic / custom single-value meta keys.
  const number =
    asString(byKey("_tracking_number")) ??
    asString(byKey("tracking_number")) ??
    asString(byKeyIncludes("tracking_number")) ??
    asString(byKeyIncludes("tracking"));

  const provider =
    asString(byKey("_tracking_provider")) ??
    asString(byKey("tracking_provider")) ??
    asString(byKey("_tracking_carrier")) ??
    asString(byKey("tracking_carrier"));

  const url =
    asString(byKey("_tracking_url")) ??
    asString(byKey("tracking_url")) ??
    asString(byKey("tracking_link")) ??
    asString(byKey("tracking_url_full"));

  if (number || provider || url) return { number, provider, url };
  return null;
}

/** True when an order carries any tracking detail (label has been purchased). */
export function hasTracking(
  order: Pick<ShopifyOrder, "meta_data"> | null | undefined
): boolean {
  return extractTracking(order) != null;
}

/**
 * Universal tracking page for a tracking number — auto-detects the carrier and
 * server-renders live status, so it works for every carrier (USPS/UPS/FedEx/
 * DHL/international) from just the number.
 *
 * We avoid both EasyShip's `custom_tracking_link` (a white-label page behind a
 * Cloudflare JS challenge that shows "You need to enable JavaScript to run this
 * app") and direct carrier pages like USPS, whose anti-bot interstitial gets
 * stuck on "Processing your request…". A universal tracker sidesteps both.
 */
export function buildUniversalTrackingUrl(
  number: string | null | undefined
): string | null {
  const num = (number ?? "").trim();
  if (!num) return null;
  return `https://parcelsapp.com/en/tracking/${encodeURIComponent(num)}`;
}

/**
 * Resolve the best "track my shipment" URL for an order's tracking: a universal
 * tracker keyed on the tracking number when we have one, otherwise the raw link
 * from the shipping plugin.
 */
export function resolveTrackingUrl(
  tracking: Pick<OrderTracking, "provider" | "number" | "url"> | null | undefined
): string | null {
  if (!tracking) return null;
  return (
    buildUniversalTrackingUrl(tracking.number) ??
    tracking.url ??
    null
  );
}
