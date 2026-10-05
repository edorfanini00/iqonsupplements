/**
 * Realistic synthetic data for previewing the order emails: real IQON catalog
 * products, approved prices and email product images, a fictional customer.
 * Used by scripts/render-order-email-previews.ts and send-order-email-preview.ts.
 */
import { renderOrderConfirmationEmail } from "../lib/orders/emails/order-confirmation";
import { renderShippingConfirmationEmail } from "../lib/orders/emails/shipping-confirmation";
import { catalogImageForHandle } from "../lib/orders/emails/images";
import type { EmailBrandConfig, EmailLineItem, OrderSnapshot, RenderedEmail } from "../lib/orders/emails/types";

function line(id: string, handle: string, title: string, variantTitle: string | null, quantity: number, unitPrice: number, sellingPlanName: string | null, brand: EmailBrandConfig): EmailLineItem {
  return {
    id, productId: null, variantId: null, title, variantTitle, quantity,
    unitPrice: unitPrice.toFixed(2), lineTotal: (unitPrice * quantity).toFixed(2),
    sellingPlanName, requiresShipping: true, imageUrl: catalogImageForHandle(handle, brand),
  };
}

export function previewOrder(brand: EmailBrandConfig): OrderSnapshot {
  return {
    orderId: "6123456789012",
    orderName: "#1042",
    email: "ava.morgan@example.com",
    firstName: "Ava",
    currency: "USD",
    test: true,
    lineItems: [
      line("1", "creatine-monohydrate", "Creatine Monohydrate", "281 g", 1, 44.07, "Delivered every 30 days, save 10%", brand),
      line("2", "collagen-peptides-chocolate", "Grass-Fed Collagen Peptides", "378 g · Chocolate", 2, 70.84, null, brand),
      line("3", "nmn", "NMN", "30 capsules", 1, 35.5, null, brand),
    ],
    subtotal: "221.25",
    discounts: "33.19",
    discountCodes: ["WELCOME15"],
    shipping: "0.00",
    tax: "16.22",
    taxesIncluded: false,
    total: "204.28",
    shippingAddress: {
      name: "Ava Morgan", company: null, address1: "1 Market Street", address2: "Apartment 4B",
      city: "San Francisco", province: "CA", zip: "94105", country: "United States",
    },
    orderStatusUrl: brand.siteUrl,
  };
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
