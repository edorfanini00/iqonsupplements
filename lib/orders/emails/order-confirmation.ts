import { brandConfig, safeHttpsUrl } from "./format";
import {
  addressHtml, button, detailBlock, eyebrow, heading, lineItemsTable, paragraph, sectionTitle, shell, spacer, supportBlock, supportText,
  textAddress, textLineItems, totalRows, totalsTable, twoColumns,
} from "./layout";
import type { EmailBrandConfig, OrderSnapshot, RenderedEmail } from "./types";

/** Customer facing "thank you" email sent once per paid order. Pure. */
export function renderOrderConfirmationEmail(order: OrderSnapshot, brand: EmailBrandConfig = brandConfig()): RenderedEmail {
  const name = order.firstName?.trim() || null;
  const subject = `Your IQON order ${order.orderName} is confirmed`;
  const preheader = `Thank you for your order. We are preparing ${order.orderName} now and will email you when it ships.`;
  const title = name ? `Thank you, ${name}.` : "Thank you for your order.";
  const intro = "Your order is confirmed and we are preparing it with care. As soon as it ships, we will send you another email with tracking details.";
  const ctaUrl = safeHttpsUrl(order.orderStatusUrl) ?? brand.siteUrl;
  const ctaLabel = safeHttpsUrl(order.orderStatusUrl) ? "View your order" : "Visit IQON";

  const address = addressHtml(order.shippingAddress);
  const details = twoColumns(
    address ? detailBlock("Delivering to", address) : "",
    supportBlock(brand),
  );

  const body = [
    eyebrow(`Order ${order.orderName}`),
    heading(title),
    paragraph(intro),
    spacer(12),
    button(ctaUrl, ctaLabel),
    spacer(36),
    sectionTitle("Your order"),
    lineItemsTable(order.lineItems, { currency: order.currency, showPrices: true, brand }),
    totalsTable(order),
    spacer(36),
    details,
  ].join("\n");

  const html = shell({ title: subject, preheader, body, brand });

  const totals = totalRows(order).map((row) => `${row.label}: ${row.value}`).join("\n");
  const addressText = textAddress(order.shippingAddress);
  const text = [
    `Order ${order.orderName}`,
    "",
    title,
    "",
    intro,
    "",
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "YOUR ORDER",
    "",
    textLineItems(order.lineItems, order.currency, true),
    "",
    totals,
    ...(addressText ? ["", "DELIVERING TO", addressText] : []),
    "",
    supportText(brand),
    "",
    "IQON Supplements & Skincare",
    brand.siteUrl,
  ].join("\n");

  return { subject, preheader, html, text };
}
