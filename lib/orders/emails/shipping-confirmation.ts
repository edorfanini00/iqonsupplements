import { resolveTrackingUrl } from "../tracking";
import { brandConfig, safeHttpsUrl } from "./format";
import {
  addressHtml, button, detailBlock, detailValue, eyebrow, heading, lineItemsTable, paragraph, sectionTitle, shell,
  spacer, supportBlock, supportText, textAddress, textLineItems, textLink, twoColumns,
} from "./layout";
import type { EmailBrandConfig, RenderedEmail, ShipmentDetails } from "./types";

/** Matches the storefront help page ("Shipping takes 3 to 5 business days"). */
export const SHIPPING_TIME_COPY = "Shipping usually takes 3 to 5 business days.";
export const MORE_TO_FOLLOW_COPY =
  "This parcel holds part of your order. The rest will follow in a separate shipment, and we will email you again when it is on its way.";

/**
 * Same preference as the storefront's order tracking (lib/orders/tracking.ts):
 * the universal tracker keyed on the number (carrier pages such as USPS stall
 * on anti bot interstitials), else Shopify's carrier link when it is https.
 */
export function shipmentTrackingUrl(shipment: Pick<ShipmentDetails, "trackingUrl" | "trackingNumber" | "carrier">): string | null {
  return resolveTrackingUrl({ provider: shipment.carrier, number: shipment.trackingNumber, url: safeHttpsUrl(shipment.trackingUrl) });
}

/** Customer facing "on its way" email sent once per fulfilment. Pure. */
export function renderShippingConfirmationEmail(shipment: ShipmentDetails, brand: EmailBrandConfig = brandConfig()): RenderedEmail {
  const name = shipment.firstName?.trim() || null;
  const partial = shipment.moreToFollow;
  const subject = partial
    ? `Part of your IQON order ${shipment.orderName} is on its way`
    : `Your IQON order ${shipment.orderName} is on its way`;
  const carrierPhrase = shipment.carrier ? ` with ${shipment.carrier}` : "";
  const preheader = shipment.carrier
    ? `Your parcel is with ${shipment.carrier}. Track it any time.`
    : "Your parcel is on its way. Track it any time.";
  const what = partial ? "Part of your order is on its way." : "Your order is on its way.";
  const title = name ? `Good news, ${name}. ${what}` : `Good news. ${what}`;
  const intro = `Your parcel has left us and is now${carrierPhrase || " on its way to you"}. ${SHIPPING_TIME_COPY}`;
  const trackingUrl = shipmentTrackingUrl(shipment);
  const orderStatusUrl = safeHttpsUrl(shipment.orderStatusUrl);

  const trackingCells = twoColumns(
    shipment.carrier ? detailBlock("Carrier", detailValue(shipment.carrier)) : "",
    shipment.trackingNumber ? detailBlock("Tracking number", detailValue(shipment.trackingNumber)) : "",
  );
  const address = addressHtml(shipment.shippingAddress);

  const body = [
    eyebrow(`Order ${shipment.orderName}`),
    heading(title),
    paragraph(intro, { last: !partial }),
    partial ? paragraph(MORE_TO_FOLLOW_COPY, { muted: true, last: true }) : "",
    spacer(28),
    trackingCells,
    trackingUrl ? `${spacer(24)}${button(trackingUrl, "Track your parcel")}` : "",
    orderStatusUrl ? `${spacer(16)}${textLink(orderStatusUrl, "View your order details")}` : "",
    spacer(40),
    sectionTitle(partial ? "In this shipment" : "Your order"),
    lineItemsTable(shipment.lineItems, { currency: "USD", showPrices: false, brand }),
    spacer(28),
    twoColumns(address ? detailBlock("Delivering to", address) : "", supportBlock(brand)),
  ].join("\n");

  const html = shell({ title: subject, preheader, body, brand });

  const addressText = textAddress(shipment.shippingAddress);
  const text = [
    `Order ${shipment.orderName}`,
    "",
    title,
    "",
    intro,
    ...(partial ? ["", MORE_TO_FOLLOW_COPY] : []),
    "",
    ...(shipment.carrier ? [`Carrier: ${shipment.carrier}`] : []),
    ...(shipment.trackingNumber ? [`Tracking number: ${shipment.trackingNumber}`] : []),
    ...(trackingUrl ? [`Track your parcel: ${trackingUrl}`] : []),
    ...(orderStatusUrl ? [`View your order details: ${orderStatusUrl}`] : []),
    "",
    partial ? "IN THIS SHIPMENT" : "YOUR ORDER",
    "",
    textLineItems(shipment.lineItems, "USD", false),
    ...(addressText ? ["", "DELIVERING TO", addressText] : []),
    "",
    supportText(brand),
    "",
    "IQON Supplements & Skincare",
    brand.siteUrl,
  ].join("\n");

  return { subject, preheader, html, text };
}
