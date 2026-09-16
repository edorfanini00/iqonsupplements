export const ORDER_FIELDS = `fragment PortalOrder on Order {
 id legacyResourceId name createdAt processedAt updatedAt cancelledAt test displayFinancialStatus displayFulfillmentStatus currencyCode email
 currentTotalPriceSet { shopMoney { amount currencyCode } }
 currentSubtotalPriceSet { shopMoney { amount currencyCode } }
 currentShippingPriceSet { shopMoney { amount currencyCode } }
 currentTotalTaxSet { shopMoney { amount currencyCode } }
 currentTotalDiscountsSet { shopMoney { amount currencyCode } }
 customer { id firstName lastName email }
 billingAddress { firstName lastName address1 address2 city provinceCode zip countryCodeV2 phone }
 shippingAddress { firstName lastName address1 address2 city provinceCode zip countryCodeV2 }
 discountCodes
 lineItems(first:100) { nodes { id name quantity currentQuantity sku product { id } image { url } originalUnitPriceSet { shopMoney { amount } } discountedTotalSet { shopMoney { amount } } originalTotalSet { shopMoney { amount } } } pageInfo { hasNextPage endCursor } }
 fulfillments { trackingInfo { company number url } }
}`;
export const ORDERS_QUERY = `${ORDER_FIELDS}\nquery PortalOrders($first:Int!,$after:String,$query:String) { orders(first:$first,after:$after,query:$query,sortKey:CREATED_AT) { nodes { ...PortalOrder } pageInfo { hasNextPage endCursor } } }`;
export const ORDER_QUERY = `${ORDER_FIELDS}\nquery PortalSingleOrder($id:ID!) { order(id:$id) { ...PortalOrder } }`;
export const PRODUCTS_QUERY = `query PortalProducts($after:String) { products(first:100,after:$after,query:"status:active") { nodes { id title handle descriptionHtml status totalInventory featuredImage { url altText } variants(first:1) { nodes { price compareAtPrice inventoryQuantity } } } pageInfo { hasNextPage endCursor } } }`;
export const CUSTOMERS_QUERY = `query PortalCustomers($after:String) { customers(first:100,after:$after,query:"email_marketing_consent_status:SUBSCRIBED") { nodes { id email firstName lastName createdAt emailMarketingConsent { marketingState } } pageInfo { hasNextPage endCursor } } }`;
export const COUPON_QUERY = `query PortalCoupon($code:String!) { codeDiscountNodeByCode(code:$code) { id codeDiscount { ... on DiscountCodeBasic { title status customerGets { value { ... on DiscountPercentage { percentage } } } } } } }`;
export const COUPON_CREATE = `mutation PortalCouponCreate($input:DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount:$input) { codeDiscountNode { id } userErrors { field message } } }`;
export const COUPON_UPDATE = `mutation PortalCouponUpdate($id:ID!,$input:DiscountCodeBasicInput!) { discountCodeBasicUpdate(id:$id,basicCodeDiscount:$input) { codeDiscountNode { id } userErrors { field message } } }`;
export const COUPON_DEACTIVATE = `mutation PortalCouponDeactivate($id:ID!) { discountCodeDeactivate(id:$id) { codeDiscountNode { id } userErrors { field message } } }`;
export const SUBSCRIPTIONS_QUERY = `query PortalSubscriptions($after:String) { subscriptionContracts(first:100,after:$after) { nodes { id status createdAt nextBillingDate currencyCode customer { id email firstName lastName } billingPolicy { interval intervalCount } originOrder { id } lastPaymentStatus lines(first:100) { nodes { id title quantity productId currentPrice { amount currencyCode } } pageInfo { hasNextPage } } } pageInfo { hasNextPage endCursor } } }`;
export const SUBSCRIPTION_PAUSE = `mutation PortalSubscriptionPause($id:ID!) { subscriptionContractPause(subscriptionContractId:$id) { contract { id status } userErrors { field message } } }`;
export const SUBSCRIPTION_ACTIVATE = `mutation PortalSubscriptionActivate($id:ID!) { subscriptionContractActivate(subscriptionContractId:$id) { contract { id status } userErrors { field message } } }`;
export const SUBSCRIPTION_CANCEL = `mutation PortalSubscriptionCancel($id:ID!) { subscriptionContractCancel(subscriptionContractId:$id) { contract { id status } userErrors { field message } } }`;
export const CUSTOMER_LOOKUP = `query PortalCustomerLookup($query:String!) { customers(first:2,query:$query) { nodes { id defaultEmailAddress { emailAddress } } } }`;
export const CUSTOMER_CREATE = `mutation PortalCustomerCreate($input:CustomerInput!) { customerCreate(input:$input) { customer { id } userErrors { field message } } }`;
export const SHOP_QUERY = `query PortalShop { shop { name myshopifyDomain currencyCode } }`;
