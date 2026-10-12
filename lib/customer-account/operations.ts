// Customer Account API documents. Every query is rooted at the signed-in customer (or a
// customer-scoped node lookup); no Admin API is used for consumer data. Validated against
// the provider schema in tests/customer-account/schema.test.ts.
//
// Core documents use only fields in Shopify's public 2026-10 reference. Fields that exist in
// the introspection schema but are not publicly documented (contract eligibility, managing app,
// subscription payment method) live in SUBSCRIPTION_EXTRAS* and are optional: if Shopify denies
// them, the page still works and those details fall back to the provider-hosted page.

const MONEY = "amount currencyCode";
const ADDRESS = `fragment IQONAddress on CustomerAddress { id firstName lastName company address1 address2 city province zoneCode country territoryCode zip phoneNumber formatted(withName: true, withCompany: true) }`;
const ORDER_SUMMARY = `fragment IQONOrderSummary on Order {
  id name processedAt financialStatus fulfillmentStatus cancelledAt
  totalPrice { ${MONEY} }
  lineItems(first: 4) { pageInfo { hasNextPage } nodes { id title quantity image { url(transform: {maxWidth: 160, maxHeight: 160}) altText } } }
}`;
const SUBSCRIPTION_SUMMARY = `fragment IQONSubscriptionSummary on SubscriptionContract {
  id status createdAt nextBillingDate currencyCode lastPaymentStatus
  billingPolicy { interval intervalCount { count } }
  deliveryPolicy { interval intervalCount { count } }
  lines(first: 6) { nodes { id name title variantTitle quantity currentPrice { ${MONEY} } image { url(transform: {maxWidth: 160, maxHeight: 160}) altText } } }
}`;
const STATUS_USER_ERRORS = "userErrors { code field message }";

export const ACCOUNT_OVERVIEW = `query IQONAccountOverview {
  customer {
    id firstName lastName displayName creationDate
    emailAddress { emailAddress }
    phoneNumber { phoneNumber }
    defaultAddress { ...IQONAddress }
    orders(first: 3, sortKey: PROCESSED_AT, reverse: true) { nodes { ...IQONOrderSummary } }
    subscriptionContracts(first: 20, sortKey: CREATED_AT, reverse: true) { nodes { id status nextBillingDate } }
  }
}
${ADDRESS}
${ORDER_SUMMARY}`;

/** The signed-in customer's id, read at sign-in with the freshly issued access token. */
export const SESSION_CUSTOMER = `query IQONSessionCustomer { customer { id } }`;

export const ACCOUNT_PROFILE = `query IQONAccountProfile {
  customer { id firstName lastName displayName emailAddress { emailAddress } phoneNumber { phoneNumber } }
}`;

export const ACCOUNT_ORDERS = `query IQONAccountOrders($after: String) {
  customer {
    orders(first: 10, after: $after, sortKey: PROCESSED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes { ...IQONOrderSummary }
    }
  }
}
${ORDER_SUMMARY}`;

export const ACCOUNT_ORDER = `query IQONAccountOrder($id: ID!) {
  order(id: $id) {
    id name processedAt financialStatus fulfillmentStatus cancelledAt cancelReason confirmationNumber statusPageUrl
    subtotal { ${MONEY} } totalShipping { ${MONEY} } totalTax { ${MONEY} } totalPrice { ${MONEY} }
    shippingAddress { ...IQONAddress }
    lineItems(first: 50) { nodes { id title variantTitle quantity totalPrice { ${MONEY} } image { url(transform: {maxWidth: 240, maxHeight: 240}) altText } } }
    fulfillments(first: 10) { nodes { id status latestShipmentStatus estimatedDeliveryAt trackingInformation { company number url } } }
  }
}
${ADDRESS}`;

export const ACCOUNT_ADDRESSES = `query IQONAccountAddresses {
  customer {
    defaultAddress { id }
    addresses(first: 50) { nodes { ...IQONAddress } }
  }
}
${ADDRESS}`;

export const ADDRESS_CREATE = `mutation IQONAddressCreate($address: CustomerAddressInput!, $defaultAddress: Boolean) {
  customerAddressCreate(address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { code field message } }
}`;
export const ADDRESS_UPDATE = `mutation IQONAddressUpdate($addressId: ID!, $address: CustomerAddressInput, $defaultAddress: Boolean) {
  customerAddressUpdate(addressId: $addressId, address: $address, defaultAddress: $defaultAddress) { customerAddress { id } userErrors { code field message } }
}`;
export const ADDRESS_DELETE = `mutation IQONAddressDelete($addressId: ID!) {
  customerAddressDelete(addressId: $addressId) { deletedAddressId userErrors { code field message } }
}`;
export const PROFILE_UPDATE = `mutation IQONProfileUpdate($input: CustomerUpdateInput!) {
  customerUpdate(input: $input) { customer { firstName lastName } userErrors { code field message } }
}`;

export const ACCOUNT_SUBSCRIPTIONS = `query IQONAccountSubscriptions {
  customer { subscriptionContracts(first: 20, sortKey: CREATED_AT, reverse: true) { nodes { ...IQONSubscriptionSummary } } }
}
${SUBSCRIPTION_SUMMARY}`;

export const ACCOUNT_SUBSCRIPTION = `query IQONAccountSubscription($id: ID!) {
  customer {
    subscriptionContract(id: $id) {
      ...IQONSubscriptionSummary
      deliveryPrice { ${MONEY} }
      deliveryMethod {
        __typename
        ... on SubscriptionDeliveryMethodShipping { address { name address1 address2 city province zip country } shippingOption { presentmentTitle title } }
        ... on SubscriptionDeliveryMethodLocalDelivery { address { name address1 address2 city province zip country } }
        ... on SubscriptionDeliveryMethodPickup { pickupOption { title } }
      }
      upcomingBillingCycles(first: 4) { nodes { cycleIndex billingAttemptExpectedDate skipped status } }
      orders(first: 5, reverse: true) { nodes { id name processedAt } }
    }
  }
}
${SUBSCRIPTION_SUMMARY}`;

const EXTRAS = `appEligibleForCustomerActions app { title }`;
export const SUBSCRIPTION_EXTRAS_LIST = `query IQONSubscriptionExtrasList {
  customer { subscriptionContracts(first: 20, sortKey: CREATED_AT, reverse: true) { nodes { id ${EXTRAS} } } }
}`;
export const SUBSCRIPTION_EXTRAS = `query IQONSubscriptionExtras($id: ID!) {
  customer {
    subscriptionContract(id: $id) {
      id ${EXTRAS}
      paymentInstrument {
        __typename
        ... on CustomerCreditCard { brand lastDigits expiryMonth expiryYear expiresSoon }
        ... on BankPaymentInstrument { bankName lastDigits }
      }
    }
  }
}`;

const CONTRACT_RESULT = `contract { id status nextBillingDate } ${STATUS_USER_ERRORS}`;
export const SUBSCRIPTION_PAUSE = `mutation IQONSubscriptionPause($id: ID!) { subscriptionContractPause(subscriptionContractId: $id) { ${CONTRACT_RESULT} } }`;
export const SUBSCRIPTION_RESUME = `mutation IQONSubscriptionResume($id: ID!) { subscriptionContractActivate(subscriptionContractId: $id) { ${CONTRACT_RESULT} } }`;
export const SUBSCRIPTION_CANCEL = `mutation IQONSubscriptionCancel($id: ID!) { subscriptionContractCancel(subscriptionContractId: $id) { ${CONTRACT_RESULT} } }`;
export const SUBSCRIPTION_SKIP = `mutation IQONSubscriptionSkip($input: SubscriptionBillingCycleInput!) {
  subscriptionBillingCycleSkip(billingCycleInput: $input) { billingCycle { cycleIndex skipped } userErrors { code field message } }
}`;
export const SUBSCRIPTION_UNSKIP = `mutation IQONSubscriptionUnskip($input: SubscriptionBillingCycleInput!) {
  subscriptionBillingCycleUnskip(billingCycleInput: $input) { billingCycle { cycleIndex skipped } userErrors { code field message } }
}`;

export const ALL_OPERATIONS = {
  SESSION_CUSTOMER, ACCOUNT_OVERVIEW, ACCOUNT_PROFILE, ACCOUNT_ORDERS, ACCOUNT_ORDER, ACCOUNT_ADDRESSES, ADDRESS_CREATE, ADDRESS_UPDATE, ADDRESS_DELETE,
  PROFILE_UPDATE, ACCOUNT_SUBSCRIPTIONS, ACCOUNT_SUBSCRIPTION, SUBSCRIPTION_EXTRAS_LIST, SUBSCRIPTION_EXTRAS, SUBSCRIPTION_PAUSE, SUBSCRIPTION_RESUME, SUBSCRIPTION_CANCEL, SUBSCRIPTION_SKIP, SUBSCRIPTION_UNSKIP,
};

/** Operations that may use fields absent from Shopify's public reference; never required. */
export const OPTIONAL_OPERATIONS = new Set(["IQONSubscriptionExtrasList", "IQONSubscriptionExtras"]);
