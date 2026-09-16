/** Normalized portal commerce DTOs, backed only by the supplements Shopify Admin API. */


export interface ShopifyImage {
  id: number;
  src: string;
  name?: string;
  alt?: string;
}

export interface ShopifyProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  type: string;
  status: string;
  description?: string;
  short_description?: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  date_created?: string;
  stock_status: "instock" | "outofstock" | "onbackorder";
  stock_quantity: number | null;
  images: ShopifyImage[];
  categories?: { id: number; name: string; slug: string }[];
  tags?: { id: number; name: string; slug: string }[];
  attributes?: { id: number; name: string; options: string[] }[];
}

export interface ShopifyCategory {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface ShopifyTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}


export interface ShopifyLineItem {
  id?: string;
  product_id: number;
  quantity: number;
  name?: string;
  price?: string;
  subtotal?: string;
  total?: string;
  image?: { src: string };
}


export interface ShopifyCartItem {
  id: string;
  name: string;
  quantity: number;
  prices: {
    price: string;
    regular_price: string;
  };
  images?: { src: string }[];
}

export interface ShopifyCartTotals {
  total_price: string;
  total_items: string;
  total_items_tax: string;
}


export interface ShopifyStoreCart {
  items: ShopifyCartItem[];
  totals?: ShopifyCartTotals;
  items_count: number;
  items_weight: number;
}


export interface ShopifyFeeLine {
  id?: number;
  name?: string | null;
  total?: string;
  total_tax?: string;
  tax_status?: "taxable" | "none";
}


export interface ShopifyCouponLine {
  id?: number;
  code: string;

  discount?: string;
  discount_tax?: string;
}


export interface ShopifyOrderPayload {
  payment_method?: string;
  payment_method_title?: string;
  set_paid?: boolean;

  status?: string;

  customer_note?: string;
  billing: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone?: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: { product_id: number; quantity: number }[];

  coupon_lines?: { code: string }[];

  shipping_lines?: { method_id: string; method_title: string; total: string }[];

  fee_lines?: ShopifyFeeLine[];
  customer_id?: number;

  meta_data?: { key: string; value: unknown }[];
}

export interface ShopifyOrder {
  updated_at?: string;
  id: number;

  order_key?: string;
  customer_id?: number;
  status: string;
  currency?: string;
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  date_paid?: string | null;
  total: string;

  shipping_total?: string;

  total_tax?: string;

  discount_total?: string;
  date_created: string;
  line_items: ShopifyLineItem[];

  fee_lines?: ShopifyFeeLine[];

  coupon_lines?: ShopifyCouponLine[];

  shipping_lines?: {
    id?: number;
    method_id?: string;
    method_title?: string;
    total?: string;
  }[];
  billing: ShopifyOrderPayload["billing"];
  shipping: ShopifyOrderPayload["shipping"];

  meta_data?: { id?: number; key: string; value: unknown }[];
}

export interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username?: string;
  billing?: Record<string, string>;
  shipping?: Record<string, string>;
  meta_data?: { id?: number; key: string; value: unknown }[];
}
