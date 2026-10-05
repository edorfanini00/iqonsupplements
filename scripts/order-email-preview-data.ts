/**
 * Realistic synthetic data for previewing the order emails: real IQON catalog
 * products, approved prices and email product images, a fictional customer.
 * Used by scripts/render-order-email-previews.ts and send-order-email-preview.ts.
 */
import { renderOrderConfirmationEmail } from "../lib/orders/emails/order-confirmation";
import { renderShippingConfirmationEmail } from "../lib/orders/emails/shipping-confirmation";
import { catalogImageForHandle } from "../lib/orders/emails/images";
import { parseOrderPaid } from "../lib/orders/webhooks/shopify-payload";
import type { EmailBrandConfig, OrderSnapshot, RenderedEmail } from "../lib/orders/emails/types";

const money = (amount: string) => ({ shop_money: { amount, currency_code: "USD" }, presentment_money: { amount, currency_code: "USD" } });

/** handle, title, variant, qty, unit price, selling plan, WELCOME15 allocation for the whole line */
const LINES: [string, string, string, number, string, string | null, string][] = [
  ["creatine-monohydrate", "Creatine Monohydrate", "281 g", 1, "44.07", "Delivered every 30 days, save 10%", "6.61"],
  ["collagen-peptides-chocolate", "Grass-Fed Collagen Peptides", "378 g · Chocolate", 2, "70.84", null, "21.25"],
  ["nmn", "NMN", "30 capsules", 1, "35.50", null, "5.33"],
];

/**
 * An orders/paid body with real Shopify semantics, run through the production
 * parser: line sum 221.25, WELCOME15 takes 33.19, subtotal_price (after
 * discounts) 188.06, tax 16.22 (8.625%), free shipping, total 204.28.
 */
export function previewOrderPayload() {
  return {
    id: 6123456789012,
    name: "#1042",
    email: "ava.morgan@example.com",
    test: true,
    currency: "USD",
    presentment_currency: "USD",
    taxes_included: false,
    // Shape of Shopify's order status link; the token and key are placeholders.
    order_status_url: "https://www.iqonbody.com/68512342/orders/7f3c2a9e41b84d6c9e0a5b1d2c3e4f50/authenticate?key=preview",
    total_line_items_price_set: money("221.25"),
    current_subtotal_price_set: money("188.06"),
    current_total_discounts_set: money("33.19"),
    current_total_tax_set: money("16.22"),
    current_total_price_set: money("204.28"),
    total_shipping_price_set: money("0.00"),
    discount_codes: [{ code: "WELCOME15", amount: "33.19", type: "percentage" }],
    customer: { first_name: "Ava", last_name: "Morgan" },
    shipping_address: {
      name: "Ava Morgan", address1: "1 Market Street", address2: "Apartment 4B", city: "San Francisco",
      province_code: "CA", zip: "94105", country: "United States",
    },
    line_items: LINES.map(([, title, variant, quantity, price, plan, discount], i) => ({
      id: 15000000000001 + i, product_id: null, variant_id: null, title, variant_title: variant, quantity, current_quantity: quantity,
      price, price_set: money(price), requires_shipping: true,
      discount_allocations: [{ amount: discount, amount_set: money(discount), discount_application_index: 0 }],
      ...(plan ? { selling_plan_allocation: { selling_plan: { name: plan } } } : {}),
    })),
  };
}

export function previewOrder(brand: EmailBrandConfig): OrderSnapshot {
  const order = parseOrderPaid(previewOrderPayload())!;
  return { ...order, lineItems: order.lineItems.map((line, i) => ({ ...line, imageUrl: catalogImageForHandle(LINES[i][0], brand) })) };
}

export interface Preview {
  slug: string;
  email: RenderedEmail;
}

export function buildPreviews(brand: EmailBrandConfig): Preview[] {
  const order = previewOrder(brand);
  const shipmentBase = {
    fulfillmentId: "5550000000001", orderId: order.orderId, orderName: order.orderName, email: order.email,
    firstName: order.firstName, shippingAddress: order.shippingAddress, orderStatusUrl: order.orderStatusUrl,
  };
  return [
    { slug: "order-confirmation", email: renderOrderConfirmationEmail(order, brand) },
    {
      slug: "shipping-confirmation",
      email: renderShippingConfirmationEmail({
        ...shipmentBase, carrier: "UPS", trackingNumber: "1Z999AA10123456784",
        trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784", lineItems: order.lineItems, moreToFollow: false,
      }, brand),
    },
    {
      slug: "shipping-confirmation-partial",
      email: renderShippingConfirmationEmail({
        ...shipmentBase, fulfillmentId: "5550000000002", carrier: "USPS", trackingNumber: "9400111899223197428490",
        trackingUrl: null, lineItems: order.lineItems.slice(0, 2), moreToFollow: true,
      }, brand),
    },
  ];
}
