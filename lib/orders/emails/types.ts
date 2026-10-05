/**
 * Data shapes for IQON customer order emails.
 *
 * `OrderSnapshot` is what we persist at orders/paid time (see
 * supplements_transactional_emails.snapshot). It deliberately holds only what
 * the two customer emails render: contact email, first name, delivery address,
 * line items and totals. No payment, billing or browser data.
 */

export interface EmailAddress {
  name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  zip: string | null;
  country: string | null;
}

export interface EmailLineItem {
  /** Shopify line item id (numeric string). */
  id: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  quantity: number;
  /** Decimal string in the order currency, per unit before discounts. */
  unitPrice: string;
  /** Decimal string, quantity x unit price before order level discounts. */
  lineTotal: string;
  sellingPlanName: string | null;
  requiresShipping: boolean;
  /** Absolute https image URL, resolved before rendering. */
  imageUrl: string | null;
}

export interface OrderSnapshot {
  orderId: string;
  orderName: string;
  email: string | null;
  firstName: string | null;
  currency: string;
  test: boolean;
  lineItems: EmailLineItem[];
  subtotal: string;
  discounts: string;
  discountCodes: string[];
  shipping: string;
  tax: string;
  taxesIncluded: boolean;
  total: string;
  shippingAddress: EmailAddress | null;
  /** Shopify hosted order status page (https), when the payload provides one. */
  orderStatusUrl: string | null;
}

export interface ShipmentDetails {
  fulfillmentId: string;
  orderId: string;
  orderName: string;
  email: string | null;
  firstName: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  lineItems: EmailLineItem[];
  shippingAddress: EmailAddress | null;
  /** True when other items on the order have not shipped yet. */
  moreToFollow: boolean;
  orderStatusUrl: string | null;
}

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

export interface EmailBrandConfig {
  /** Absolute https origin for images and links, no trailing slash. */
  assetOrigin: string;
  siteUrl: string;
  supportEmail: string;
}
