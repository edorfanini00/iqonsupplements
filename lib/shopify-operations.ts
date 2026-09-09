// Storefront operations only. No Admin token is used by the website.
export const CATALOG_QUERY = `query IQONCatalog($after: String) {
  products(first: 30, after: $after, query: "tag:iqon-supplements OR tag:iqon-skincare", sortKey: TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id handle title description productType tags availableForSale requiresSellingPlan
      images(first: 10) { nodes { url altText } }
      variants(first: 100) {
        pageInfo { hasNextPage }
        nodes { id title availableForSale price { amount currencyCode } }
      }
    }
  }
}`;

const CART_FRAGMENT = `fragment IQONCart on Cart {
  id checkoutUrl totalQuantity
  cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
  lines(first: 100) {
    pageInfo { hasNextPage }
    nodes {
      id quantity cost { totalAmount { amount currencyCode } }
      merchandise { ... on ProductVariant {
        id title image { url altText }
        product { handle title }
      } }
    }
  }
}`;
const CART_QUERY_BODY = `query IQONCartRead($id: ID!) { cart(id: $id) { ...IQONCart } }`;
const CREATE_BODY = `mutation IQONCartCreate($input: CartInput!) {
  cartCreate(input: $input) { cart { ...IQONCart } userErrors { field message } warnings { message } }
}`;
const ADD_BODY = `mutation IQONCartAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...IQONCart } userErrors { field message } warnings { message } }
}`;
const UPDATE_BODY = `mutation IQONCartUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...IQONCart } userErrors { field message } warnings { message } }
}`;
const REMOVE_BODY = `mutation IQONCartRemove($cartId: ID!, $lineIds: [ID!]!) {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...IQONCart } userErrors { field message } warnings { message } }
}`;
export const CART_QUERY = CART_QUERY_BODY + CART_FRAGMENT;
export const CART_CREATE = CREATE_BODY + CART_FRAGMENT;
export const CART_ADD = ADD_BODY + CART_FRAGMENT;
export const CART_UPDATE = UPDATE_BODY + CART_FRAGMENT;
export const CART_REMOVE = REMOVE_BODY + CART_FRAGMENT;
export const ALL_OPERATIONS = [CATALOG_QUERY, CART_QUERY_BODY, CREATE_BODY, ADD_BODY, UPDATE_BODY, REMOVE_BODY, CART_FRAGMENT].join("\n");
