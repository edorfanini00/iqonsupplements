// MOCK Shopify Customer Account provider for tests. NOT Shopify. Synthetic customers only.
// Implements the documented contract this site depends on: public-client PKCE token
// exchange, refresh, JWKS/RS256 id_token, and the Customer Account GraphQL operations
// used by lib/customer-account/operations.ts. State can live in memory (unit tests) or a
// JSON file (browser tests, shared between the test runner and the `next start` server).
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import fs from "node:fs";

export const SHOP_ID = "100000000001";
export const CLIENT_ID = "mock-client-id-0001";
const b64u = buffer => Buffer.from(buffer).toString("base64url");
const token = prefix => `${prefix}_${randomBytes(18).toString("base64url")}`;

function seedCustomers() {
  const money = amount => ({amount, currencyCode: "USD"});
  const address = (id, first, last, line1, city, zone, zip) => ({id: `gid://shopify/CustomerAddress/${id}`, firstName: first, lastName: last, company: "", address1: line1, address2: "", city, province: zone, zoneCode: zone, country: "United States", territoryCode: "US", zip, phoneNumber: ""});
  const order = (id, number, date, total, items, extra = {}) => ({
    id: `gid://shopify/Order/${id}`, name: `#${number}`, number, processedAt: date, financialStatus: "PAID", fulfillmentStatus: "FULFILLED", cancelledAt: null, cancelReason: null,
    confirmationNumber: `MOCK${number}`, statusPageUrl: `https://shopify.com/${SHOP_ID}/account/orders/${id}?mock=1`,
    subtotal: money(total), totalShipping: money("0.00"), totalTax: money("0.00"), totalPrice: money(total),
    lineItems: items.map((item, i) => ({id: `gid://shopify/LineItem/${id}${i}`, title: item[0], variantTitle: null, quantity: item[1], sellingPlan: item[2] ? {name: item[2]} : null, totalPrice: money(total), image: null})),
    fulfillments: [{id: `gid://shopify/Fulfillment/${id}`, status: "SUCCESS", latestShipmentStatus: "DELIVERED", estimatedDeliveryAt: null, trackingInformation: [{company: "Mock Carrier", number: `MOCK${id}`, url: `https://tracking.example.test/${id}`}]}],
    ...extra,
  });
  const cycles = start => [0, 1, 2, 3].map(i => ({cycleIndex: 4 + i, billingAttemptExpectedDate: new Date(Date.parse(start) + i * 30 * 86400000).toISOString(), skipped: false, status: "UNBILLED"}));
  const contract = (id, status, eligible, next, line, extra = {}) => ({
    id: `gid://shopify/SubscriptionContract/${id}`, status, createdAt: "2026-06-01T12:00:00Z", nextBillingDate: next, currencyCode: "USD",
    appEligibleForCustomerActions: eligible, lastPaymentStatus: "SUCCEEDED", app: {title: eligible ? "Shopify Subscriptions" : "Another subscription app"},
    billingPolicy: {interval: "MONTH", intervalCount: {count: 1}}, deliveryPolicy: {interval: "MONTH", intervalCount: {count: 1}},
    lines: [{id: `gid://shopify/SubscriptionLine/${id}`, name: line, title: line, variantTitle: null, quantity: 1, currentPrice: money("42.00"), image: null}],
    deliveryPrice: money("0.00"),
    deliveryMethod: {__typename: "SubscriptionDeliveryMethodShipping", address: {name: "Synthetic Recipient", address1: "1 Subscription Way", address2: null, city: "Austin", province: "TX", zip: "73301", country: "United States"}, shippingOption: {presentmentTitle: "Standard", title: "Standard"}},
    paymentInstrument: {__typename: "CustomerCreditCard", brand: "visa", lastDigits: "4242", expiryMonth: 4, expiryYear: 2030, expiresSoon: false},
    upcomingBillingCycles: next ? cycles(next) : [],
    orders: [{id: `gid://shopify/Order/${id}1`, name: `#S${id}`, processedAt: "2026-09-01T12:00:00Z"}],
    ...extra,
  });
  return {
    "gid://shopify/Customer/7001": {
      id: "gid://shopify/Customer/7001", firstName: "Avery", lastName: "Synthetic", email: "avery.synthetic@example.test", phone: null, creationDate: "2026-05-02T10:00:00Z",
      addresses: [address(8101, "Avery", "Synthetic", "100 Mock Street", "Austin", "TX", "73301"), address(8102, "Avery", "Synthetic", "22 Fixture Avenue", "Denver", "CO", "80202")],
      defaultAddressId: "gid://shopify/CustomerAddress/8101",
      orders: [order(9101, 1101, "2026-09-20T15:00:00Z", "84.00", [["Creatine Monohydrate", 2, null]]), order(9102, 1088, "2026-08-11T15:00:00Z", "42.00", [["Marine Collagen", 1, "Delivered monthly"]])],
      subscriptions: [contract(6101, "ACTIVE", true, "2026-11-01T12:00:00Z", "Marine Collagen"), contract(6102, "PAUSED", true, null, "Magnesium Glycinate"), contract(6103, "ACTIVE", false, "2026-11-15T12:00:00Z", "Omega-3")],
    },
    "gid://shopify/Customer/7002": {
      id: "gid://shopify/Customer/7002", firstName: "Blake", lastName: "Synthetic", email: "blake.synthetic@example.test", phone: null, creationDate: "2026-07-09T10:00:00Z",
      addresses: [address(8201, "Blake", "Synthetic", "9 Isolation Road", "Portland", "OR", "97201")], defaultAddressId: "gid://shopify/CustomerAddress/8201",
      orders: [order(9201, 1201, "2026-09-25T15:00:00Z", "39.00", [["Vitamin D3 + K2", 1, null]])],
      subscriptions: [contract(6201, "ACTIVE", true, "2026-10-30T12:00:00Z", "Creatine Monohydrate")],
    },
    "gid://shopify/Customer/7003": {
      id: "gid://shopify/Customer/7003", firstName: "", lastName: "", email: "new.synthetic@example.test", phone: null, creationDate: "2026-10-11T10:00:00Z",
      addresses: [], defaultAddressId: null, orders: [], subscriptions: [],
    },
  };
}

function initialState() {
  const {privateKey, publicKey} = generateKeyPairSync("rsa", {modulusLength: 2048});
  return {
    privateKey: privateKey.export({format: "pem", type: "pkcs8"}),
    jwk: {...publicKey.export({format: "jwk"}), kid: "mock-key-1", use: "sig", alg: "RS256"},
    codes: {}, access: {}, refresh: {}, customers: seedCustomers(), nextId: 9900,
    config: {expiresIn: 3600, rotateRefresh: true, failGraphql: 0, failToken: 0, tokenOverride: null, restrictHidden: false},
    ledger: [],
  };
}

export function createFakeProvider({origin, file} = {}) {
  let memory = file && fs.existsSync(file) && fs.statSync(file).size ? null : initialState();
  if (file && memory) fs.writeFileSync(file, JSON.stringify(memory));
  const load = () => file ? JSON.parse(fs.readFileSync(file, "utf8")) : memory;
  const save = state => { if (file) fs.writeFileSync(file, JSON.stringify(state)); else memory = state; };
  const mutate = fn => { const state = load(); const result = fn(state); save(state); return result; };
  const base = `https://shopify.com/authentication/${SHOP_ID}`;
  const graphqlPrefix = `https://shopify.com/${SHOP_ID}/account/customer/api/`;

  function idToken(state, sub, nonce) {
    const now = Math.floor(Date.now() / 1000);
    const header = b64u(JSON.stringify({alg: "RS256", kid: state.jwk.kid, typ: "JWT"}));
    const payload = b64u(JSON.stringify({iss: base, aud: CLIENT_ID, sub, nonce, iat: now, exp: now + 3600, email: state.customers[sub].email, sid: token("sid")}));
    return `${header}.${payload}.${b64u(sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), state.privateKey))}`;
  }

  /** Simulates the customer completing Shopify's email-code sign-in for `customer`. */
  function authorize(authorizeUrl, customer = "gid://shopify/Customer/7001") {
    const url = new URL(authorizeUrl);
    const p = url.searchParams;
    if (url.origin + url.pathname !== `${base}/oauth/authorize`) throw new Error("MOCK authorize: wrong endpoint");
    if (p.get("client_id") !== CLIENT_ID || p.get("response_type") !== "code" || p.get("code_challenge_method") !== "S256" || p.get("scope") !== "openid email customer-account-api:full") throw new Error("MOCK authorize: invalid parameters");
    const code = token("mockcode");
    mutate(state => { state.codes[code] = {customer, challenge: p.get("code_challenge"), nonce: p.get("nonce"), redirectUri: p.get("redirect_uri"), used: false}; });
    const back = new URL(p.get("redirect_uri"));
    back.searchParams.set("code", code); back.searchParams.set("state", p.get("state"));
    return back.href;
  }

  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json"}});

  function tokenEndpoint(headers, body) {
    return mutate(state => {
      state.ledger.push({op: "token", grant: body.get("grant_type"), origin: headers.get("origin"), ua: !!headers.get("user-agent")});
      if (state.config.failToken > 0) { state.config.failToken--; return json({error: "temporarily_unavailable"}, 503); }
      if (headers.get("origin") !== origin) return json({error: "invalid_token"}, 401);
      if (!headers.get("user-agent")) return json({error: "forbidden"}, 403);
      if (body.get("client_id") !== CLIENT_ID) return json({error: "invalid_client"}, 401);
      const issue = (customer, nonce) => {
        const access = token("mockat"), refresh = token("mockrt");
        state.access[access] = {customer, exp: Date.now() + state.config.expiresIn * 1000};
        state.refresh[refresh] = {customer, used: false};
        return {access_token: access, expires_in: state.config.expiresIn, refresh_token: refresh, id_token: idToken(state, customer, nonce), token_type: "Bearer"};
      };
      if (body.get("grant_type") === "authorization_code") {
        const record = state.codes[body.get("code")];
        if (!record || record.used) return json({error: "invalid_grant"}, 400);
        record.used = true;
        if (record.redirectUri !== body.get("redirect_uri")) return json({error: "invalid_grant"}, 400);
        if (createHash("sha256").update(body.get("code_verifier") || "").digest("base64url") !== record.challenge) return json({error: "invalid_grant"}, 400);
        const issued = issue(record.customer, record.nonce);
        if (state.config.tokenOverride) Object.assign(issued, state.config.tokenOverride(issued, state) ?? {});
        return json(issued);
      }
      if (body.get("grant_type") === "refresh_token") {
        const record = state.refresh[body.get("refresh_token")];
        if (!record || record.used) return json({error: "invalid_grant"}, 400);
        if (state.config.rotateRefresh) record.used = true;
        state.ledger.push({op: "refresh", customer: record.customer});
        const issued = issue(record.customer, undefined);
        delete issued.id_token;
        return json(issued);
      }
      return json({error: "unsupported_grant_type"}, 400);
    });
  }

  function graphql(headers, body) {
    return mutate(state => {
      const name = /(?:query|mutation)\s+(\w+)/.exec(body.query)?.[1];
      state.ledger.push({op: "graphql", name, auth: !!headers.get("authorization"), origin: headers.get("origin")});
      if (state.config.failGraphql > 0) { state.config.failGraphql--; return json({errors: [{message: "Internal error"}]}, 503); }
      // Simulates Shopify refusing fields that exist in the schema but not in its public reference.
      if (state.config.restrictHidden && /appEligibleForCustomerActions|paymentInstrument/.test(body.query)) return json({data: null, errors: [{message: "Access denied for appEligibleForCustomerActions field.", extensions: {code: "ACCESS_DENIED"}}]});
      const session = state.access[headers.get("authorization") || ""];
      if (!session || session.exp < Date.now()) return new Response("", {status: 401, headers: {"www-authenticate": "Bearer error=\"invalid_token\""}});
      const c = state.customers[session.customer];
      state.ledger.push({op: "as", name, customer: c.id});
      const v = body.variables || {};
      const addresses = () => c.addresses.map(a => ({...a, formatted: [`${a.firstName} ${a.lastName}`.trim(), a.address1, a.address2, `${a.city} ${a.zoneCode} ${a.zip}`, a.country].filter(Boolean)}));
      const customer = () => ({
        id: c.id, firstName: c.firstName, lastName: c.lastName, displayName: `${c.firstName} ${c.lastName}`.trim() || c.email, creationDate: c.creationDate,
        emailAddress: {emailAddress: c.email}, phoneNumber: c.phone ? {phoneNumber: c.phone} : null,
        defaultAddress: addresses().find(a => a.id === c.defaultAddressId) || null,
        addresses: {nodes: addresses()},
        orders: {pageInfo: {hasNextPage: false, endCursor: null}, nodes: c.orders.map(o => ({...o, lineItems: {nodes: o.lineItems}, fulfillments: {nodes: o.fulfillments}}))},
        subscriptionContracts: {nodes: c.subscriptions.map(contractView)},
      });
      const contractView = s => ({...s, lines: {nodes: s.lines}, upcomingBillingCycles: {nodes: s.upcomingBillingCycles}, orders: {nodes: s.orders}});
      const userError = message => ({userErrors: [{code: "INVALID", field: null, message}]});
      const own = (list, id) => list.find(item => item.id === id);
      const addressInput = input => ({...input, province: input.zoneCode, country: input.territoryCode === "US" ? "United States" : input.territoryCode});
      switch (name) {
        case "IQONAccountOverview": case "IQONAccountProfile": case "IQONAccountOrders": case "IQONAccountAddresses": case "IQONAccountSubscriptions": case "IQONSubscriptionExtrasList":
          return json({data: {customer: customer()}});
        case "IQONAccountOrder": {
          const o = own(c.orders, v.id);
          return json({data: {order: o ? {...o, lineItems: {nodes: o.lineItems}, fulfillments: {nodes: o.fulfillments}} : null}});
        }
        case "IQONAccountSubscription": case "IQONSubscriptionExtras": {
          const s = own(c.subscriptions, v.id);
          return json({data: {customer: {subscriptionContract: s ? contractView(s) : null}}});
        }
        case "IQONAddressCreate": {
          if (!v.address?.address1) return json({data: {customerAddressCreate: {customerAddress: null, ...userError("Address1 can't be blank")}}});
          if (v.address.zip === "00000") return json({data: {customerAddressCreate: {customerAddress: null, userErrors: [{code: "INVALID", field: ["address", "zip"], message: "Enter a valid ZIP code for Texas"}]}}});
          const id = `gid://shopify/CustomerAddress/${state.nextId++}`;
          c.addresses.push({id, company: "", address2: "", phoneNumber: "", ...addressInput(v.address)});
          if (v.defaultAddress || !c.defaultAddressId) c.defaultAddressId = id;
          return json({data: {customerAddressCreate: {customerAddress: {id}, userErrors: []}}});
        }
        case "IQONAddressUpdate": {
          const a = own(c.addresses, v.addressId);
          if (!a) return json({data: {customerAddressUpdate: {customerAddress: null, ...userError("Address does not exist")}}});
          if (v.address) Object.assign(a, addressInput(v.address));
          if (v.defaultAddress) c.defaultAddressId = a.id;
          return json({data: {customerAddressUpdate: {customerAddress: {id: a.id}, userErrors: []}}});
        }
        case "IQONAddressDelete": {
          const a = own(c.addresses, v.addressId);
          if (!a) return json({data: {customerAddressDelete: {deletedAddressId: null, ...userError("Address does not exist")}}});
          c.addresses = c.addresses.filter(x => x !== a);
          if (c.defaultAddressId === a.id) c.defaultAddressId = c.addresses[0]?.id || null;
          return json({data: {customerAddressDelete: {deletedAddressId: a.id, userErrors: []}}});
        }
        case "IQONProfileUpdate":
          Object.assign(c, {firstName: v.input.firstName ?? c.firstName, lastName: v.input.lastName ?? c.lastName});
          return json({data: {customerUpdate: {customer: {firstName: c.firstName, lastName: c.lastName}, userErrors: []}}});
        case "IQONSubscriptionPause": case "IQONSubscriptionResume": case "IQONSubscriptionCancel": {
          const field = {IQONSubscriptionPause: "subscriptionContractPause", IQONSubscriptionResume: "subscriptionContractActivate", IQONSubscriptionCancel: "subscriptionContractCancel"}[name];
          const s = own(c.subscriptions, v.id);
          if (!s) return json({data: {[field]: {contract: null, userErrors: [{code: "SUBSCRIPTION_CONTRACT_DOES_NOT_EXIST", field: null, message: "Contract does not exist"}]}}});
          if (!s.appEligibleForCustomerActions) return json({data: {[field]: {contract: null, ...userError("Not eligible for customer actions")}}});
          s.status = {IQONSubscriptionPause: "PAUSED", IQONSubscriptionResume: "ACTIVE", IQONSubscriptionCancel: "CANCELLED"}[name];
          state.ledger.push({op: "subscription", name, id: s.id, customer: c.id});
          return json({data: {[field]: {contract: {id: s.id, status: s.status, nextBillingDate: s.nextBillingDate}, userErrors: []}}});
        }
        case "IQONSubscriptionSkip": case "IQONSubscriptionUnskip": {
          const field = name === "IQONSubscriptionSkip" ? "subscriptionBillingCycleSkip" : "subscriptionBillingCycleUnskip";
          const s = own(c.subscriptions, v.input?.contractId);
          const cycle = s?.upcomingBillingCycles.find(x => x.cycleIndex === v.input?.selector?.index);
          if (!s || !cycle) return json({data: {[field]: {billingCycle: null, ...userError("Billing cycle not found")}}});
          cycle.skipped = name === "IQONSubscriptionSkip";
          state.ledger.push({op: "subscription", name, id: s.id, cycle: cycle.cycleIndex, customer: c.id});
          return json({data: {[field]: {billingCycle: {cycleIndex: cycle.cycleIndex, skipped: cycle.skipped}, userErrors: []}}});
        }
        default:
          return json({errors: [{message: `MOCK: unknown operation ${name}`}]});
      }
    });
  }

  async function fakeFetch(input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url);
    const headers = new Headers(init.headers);
    if (url.href === `${base}/oauth/token` && init.method === "POST") return tokenEndpoint(headers, new URLSearchParams(String(init.body)));
    if (url.href === `${base}/.well-known/jwks.json`) return json({keys: [load().jwk]});
    if (url.href.startsWith(graphqlPrefix) && init.method === "POST") return graphql(headers, JSON.parse(String(init.body)));
    return null;
  }

  return {
    fetch: fakeFetch, authorize, load, mutate,
    configure: patch => mutate(state => Object.assign(state.config, patch)),
    ledger: () => load().ledger,
    signIdToken: (sub, nonce, claims = {}) => { const state = load(); const now = Math.floor(Date.now() / 1000); const header = b64u(JSON.stringify({alg: "RS256", kid: state.jwk.kid})); const payload = b64u(JSON.stringify({iss: base, aud: CLIENT_ID, sub, nonce, iat: now, exp: now + 3600, ...claims})); return `${header}.${payload}.${b64u(sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), state.privateKey))}`; },
  };
}
