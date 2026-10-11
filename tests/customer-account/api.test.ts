import assert from "node:assert/strict";
import { test } from "node:test";
import { CUSTOMER_A, CUSTOMER_B, CUSTOMER_NEW, handlers, mutation, ORIGIN, request, setup, signIn } from "./harness";
import { writeChunked, readChunked, parseCookies, MAX_CHUNKS } from "@/lib/customer-account/cookies";

type Ledger = {op: string; name?: string; id?: string; customer?: string}[];
const mutations = (ledger: Ledger) => ledger.filter(e => e.op === "subscription" || (e.op === "graphql" && /Create|Update|Delete|Pause|Resume|Cancel|Skip/.test(e.name || "")));

test("customer responses are private, uncached and isolated between customers A and B", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A), b = await signIn(t, CUSTOMER_B);
  const [ra, rb] = await Promise.all([handlers.overviewApi(request("/api/account/overview", a.jar), t.deps), handlers.overviewApi(request("/api/account/overview", b.jar), t.deps)]);
  for (const r of [ra, rb]) {
    assert.equal(r.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(r.headers.get("vary"), "Cookie");
  }
  const [oa, ob] = [await ra.json(), await rb.json()];
  assert.equal(oa.profile.email, "avery.synthetic@example.test");
  assert.equal(ob.profile.email, "blake.synthetic@example.test");
  assert.deepEqual(oa.recentOrders.map((o: {id: string}) => o.id), ["9101", "9102"]);
  assert.deepEqual(ob.recentOrders.map((o: {id: string}) => o.id), ["9201"]);
  assert.equal(oa.subscriptions.active, 2);
  assert.ok(!JSON.stringify(oa).includes("blake"), "no cross-account data");
});

test("anti-IDOR: A cannot read or change B's order, address or subscription", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A);
  const before = mutations(t.provider.ledger()).length;
  assert.equal((await handlers.orderApi(request("/api/account/orders/9201", a.jar), "9201", t.deps)).status, 404);
  assert.equal((await handlers.subscriptionApi(request("/api/account/subscriptions/6201", a.jar), "6201", t.deps)).status, 404);
  assert.equal((await handlers.updateAddressApi(mutation("/api/account/addresses/8201", a.jar, a.csrf, "PATCH", {makeDefault: true}), "8201", t.deps)).status, 404);
  assert.equal((await handlers.deleteAddressApi(mutation("/api/account/addresses/8201", a.jar, a.csrf, "DELETE", {}), "8201", t.deps)).status, 404);
  assert.equal((await handlers.subscriptionActionApi(mutation("/api/account/subscriptions/6201/actions", a.jar, a.csrf, "POST", {action: "pause"}), "6201", t.deps)).status, 404);
  assert.equal(mutations(t.provider.ledger()).length, before, "no write reached the provider");
  // Malformed ids never reach the provider as arbitrary GIDs.
  for (const id of ["gid://shopify/Order/9201", "../9201", "9201?x", "-1", "1e3"]) assert.equal((await handlers.orderApi(request(`/api/account/orders/x`, a.jar), id, t.deps)).status, 404, id);
  const own = await handlers.orderApi(request("/api/account/orders/9101", a.jar), "9101", t.deps);
  assert.equal(own.status, 200);
  const order = await own.json();
  assert.equal(order.name, "#1101");
  assert.match(order.statusPageUrl, /^https:\/\/shopify\.com\//);
});

test("mutations require same-origin JSON and the session's CSRF token", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A), b = await signIn(t, CUSTOMER_B);
  const body = {firstName: "Changed"};
  const cases: [string, Request][] = [
    ["missing csrf", mutation("/api/account/profile", a.jar, "", "PATCH", body)],
    ["other session's csrf", mutation("/api/account/profile", a.jar, b.csrf, "PATCH", body)],
    ["cross origin", mutation("/api/account/profile", a.jar, a.csrf, "PATCH", body, {origin: "https://evil.example"})],
    ["no origin", new Request(`${ORIGIN}/api/account/profile`, {method: "PATCH", body: JSON.stringify(body), headers: {cookie: a.jar.header(), "content-type": "application/json", "x-iqb-csrf": a.csrf}})],
    ["cross-site fetch metadata", mutation("/api/account/profile", a.jar, a.csrf, "PATCH", body, {"sec-fetch-site": "cross-site"})],
    ["form content type", mutation("/api/account/profile", a.jar, a.csrf, "PATCH", body, {"content-type": "text/plain"})],
  ];
  for (const [name, req] of cases) {
    const response = await handlers.updateProfileApi(req, t.deps);
    assert.ok([403, 415].includes(response.status), `${name}: ${response.status}`);
  }
  assert.equal(t.provider.ledger().filter((e: {name?: string}) => e.name === "IQONProfileUpdate").length, 0);
  const ok = await handlers.updateProfileApi(mutation("/api/account/profile", a.jar, a.csrf, "PATCH", {firstName: "  Avery  Ann ", lastName: "Synthetic"}), t.deps);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).firstName, "Avery Ann");
  const oversized = await handlers.updateProfileApi(mutation("/api/account/profile", a.jar, a.csrf, "PATCH", {firstName: "x".repeat(9000)}), t.deps);
  assert.equal(oversized.status, 413);
  const extra = await handlers.updateProfileApi(mutation("/api/account/profile", a.jar, a.csrf, "PATCH", {firstName: "A", email: "takeover@example.test"}), t.deps);
  assert.equal(extra.status, 422, "email and other fields are not writable here");
});

test("address book: validation, create with default, edit, set default, delete persist through the provider", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A);
  const valid = {firstName: "Avery", lastName: "Synthetic", address1: "500 New Road", city: "Austin", territoryCode: "US", zoneCode: "TX", zip: "73301", phoneNumber: "(512) 555-0100"};
  const invalid: [Record<string, unknown>, string][] = [
    [{...valid, address1: "   "}, "address1"], [{...valid, city: ""}, "city"], [{...valid, territoryCode: "usa"}, "territoryCode"],
    [{...valid, zoneCode: "<script>"}, "zoneCode"], [{...valid, address2: "line\u0000two"}, "address2"], [{...valid, phoneNumber: "555"}, "phoneNumber"],
    [{...valid, customerId: "gid://shopify/Customer/7002"}, "form"], [{...valid, address1: "x".repeat(201)}, "address1"],
  ];
  for (const [body, field] of invalid) {
    const response = await handlers.createAddressApi(mutation("/api/account/addresses", a.jar, a.csrf, "POST", body), t.deps);
    assert.equal(response.status, 422, field);
    const data = await response.json();
    assert.ok(data.fields[field] || (field === "form" && Object.keys(data.fields).length), `${field}: ${JSON.stringify(data.fields)}`);
  }
  assert.equal(t.provider.ledger().filter((e: {name?: string}) => e.name === "IQONAddressCreate").length, 0, "invalid input never reaches Shopify");

  // Provider-side validation errors are surfaced per field.
  const rejected = await handlers.createAddressApi(mutation("/api/account/addresses", a.jar, a.csrf, "POST", {...valid, zip: "00000"}), t.deps);
  assert.equal(rejected.status, 422);
  assert.equal((await rejected.json()).fields.zip, "Enter a valid ZIP code for Texas");

  let response = await handlers.createAddressApi(mutation("/api/account/addresses", a.jar, a.csrf, "POST", {...valid, makeDefault: true}), t.deps);
  assert.equal(response.status, 201);
  let book = (await response.json()).addresses;
  assert.equal(book.length, 3);
  assert.equal(book[0].address1, "500 New Road");
  assert.equal(book[0].isDefault, true);
  assert.equal(book[0].phoneNumber, "+15125550100");
  const created = book[0].id;

  response = await handlers.updateAddressApi(mutation(`/api/account/addresses/${created}`, a.jar, a.csrf, "PATCH", {...valid, address1: "501 New Road"}), created, t.deps);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).addresses.find((x: {id: string}) => x.id === created).address1, "501 New Road");

  response = await handlers.updateAddressApi(mutation("/api/account/addresses/8102", a.jar, a.csrf, "PATCH", {makeDefault: true}), "8102", t.deps);
  book = (await response.json()).addresses;
  assert.equal(book[0].id, "8102");
  assert.equal(book.filter((x: {isDefault: boolean}) => x.isDefault).length, 1);

  response = await handlers.deleteAddressApi(mutation(`/api/account/addresses/${created}`, a.jar, a.csrf, "DELETE", {}), created, t.deps);
  assert.equal(response.status, 200);
  assert.ok(!(await response.json()).addresses.some((x: {id: string}) => x.id === created));
  // Re-read from the provider: persistence, not client state.
  const reread = await (await handlers.addressesApi(request("/api/account/addresses", a.jar), t.deps)).json();
  assert.deepEqual(reread.addresses.map((x: {id: string}) => x.id), ["8102", "8101"]);
});

test("subscriptions: provider eligibility gates actions; pause, resume, skip, unskip and confirmed cancel", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A);
  const list = await (await handlers.subscriptionsApi(request("/api/account/subscriptions", a.jar), t.deps)).json();
  const byId = Object.fromEntries(list.subscriptions.map((s: {id: string}) => [s.id, s]));
  assert.deepEqual(byId["6101"].actions, ["pause", "skip", "unskip", "cancel"]);
  assert.deepEqual(byId["6102"].actions, ["resume", "cancel"]);
  assert.deepEqual(byId["6103"].actions, [], "contracts not eligible for customer actions get no native buttons");
  assert.equal(byId["6101"].managementUrl, null);

  const act = (id: string, body: unknown) => handlers.subscriptionActionApi(mutation(`/api/account/subscriptions/${id}/actions`, a.jar, a.csrf, "POST", body), id, t.deps);
  const before = mutations(t.provider.ledger()).length;
  assert.equal((await act("6103", {action: "pause"})).status, 409);
  assert.equal((await act("6102", {action: "pause"})).status, 409, "a paused contract cannot be paused again");
  assert.equal((await act("6101", {action: "cancel"})).status, 400, "cancel requires explicit confirmation");
  assert.equal((await act("6101", {action: "frequency", interval: "WEEK"})).status, 400, "no invented frequency mutation");
  assert.equal((await act("6101", {action: "skip", cycleIndex: 99})).status, 409);
  assert.equal(mutations(t.provider.ledger()).length, before, "rejected actions never reach Shopify");

  let detail = await (await act("6101", {action: "skip", cycleIndex: 4})).json();
  assert.equal(detail.upcoming.find((c: {cycleIndex: number}) => c.cycleIndex === 4).skipped, true);
  assert.equal((await act("6101", {action: "skip", cycleIndex: 4})).status, 409, "already skipped");
  detail = await (await act("6101", {action: "unskip", cycleIndex: 4})).json();
  assert.equal(detail.upcoming.find((c: {cycleIndex: number}) => c.cycleIndex === 4).skipped, false);
  detail = await (await act("6101", {action: "pause"})).json();
  assert.equal(detail.status, "PAUSED");
  detail = await (await act("6101", {action: "resume"})).json();
  assert.equal(detail.status, "ACTIVE");
  detail = await (await act("6102", {action: "cancel", confirm: true})).json();
  assert.equal(detail.status, "CANCELLED");
  assert.deepEqual(detail.actions, []);
  assert.equal(detail.payment.kind, "card");
  assert.equal(detail.payment.lastDigits, "4242");
  assert.ok(!("number" in detail.payment) && !JSON.stringify(detail).includes("cvv"));
});

test("subscription management link appears only when the provider page is published", async () => {
  const t = setup({env: {...(await import("./harness")).env, SHOPIFY_SUBSCRIPTION_MANAGEMENT_PUBLISHED: "true"}});
  const a = await signIn(t, CUSTOMER_A);
  const list = await (await handlers.subscriptionsApi(request("/api/account/subscriptions", a.jar), t.deps)).json();
  assert.match(list.managementUrl, /^https:\/\/shopify\.com\/100000000001\/account\/pages\//);
  assert.equal(a.session.subscriptionManagementUrl, list.managementUrl);
});

test("a brand-new customer gets real empty states, not fabricated rows", async () => {
  const t = setup();
  const n = await signIn(t, CUSTOMER_NEW);
  const overview = await (await handlers.overviewApi(request("/api/account/overview", n.jar), t.deps)).json();
  assert.deepEqual(overview.recentOrders, []);
  assert.equal(overview.defaultAddress, null);
  assert.deepEqual(overview.subscriptions, {active: 0, paused: 0, nextBillingDate: null});
  assert.deepEqual((await (await handlers.subscriptionsApi(request("/api/account/subscriptions", n.jar), t.deps)).json()).subscriptions, []);
});

test("upstream failures are 'unavailable' and keep the session; nothing leaks tokens or customer data to logs", async () => {
  const t = setup();
  const logs: string[] = [];
  const original = {log: console.log, warn: console.warn, error: console.error};
  for (const level of ["log", "warn", "error"] as const) console[level] = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
  const bodies: string[] = [];
  try {
    const a = await signIn(t, CUSTOMER_A);
    t.provider.configure({failGraphql: 1});
    const response = await handlers.ordersApi(request("/api/account/orders", a.jar), t.deps);
    assert.equal(response.status, 503);
    assert.equal(response.headers.getSetCookie().length, 0);
    bodies.push(JSON.stringify(await response.json()));
    for (const [path, fn] of [["/api/account/overview", handlers.overviewApi], ["/api/account/orders", handlers.ordersApi], ["/api/account/addresses", handlers.addressesApi], ["/api/account/subscriptions", handlers.subscriptionsApi], ["/api/account/session", handlers.sessionApi]] as const) {
      const r = await fn(request(path, a.jar), t.deps);
      bodies.push(await r.text(), JSON.stringify([...r.headers]));
    }
    bodies.push(await (await handlers.subscriptionApi(request("/api/account/subscriptions/6101", a.jar), "6101", t.deps)).text());
    // Bad cursor input is rejected before reaching Shopify.
    assert.equal((await handlers.ordersApi(request("/api/account/orders?after=%7B%22x%22%7D", a.jar), t.deps)).status, 400);
  } finally { Object.assign(console, original); }
  const state = t.provider.load();
  const secrets = [...Object.keys(state.access), ...Object.keys(state.refresh), "eyJ"];
  for (const secret of secrets) {
    assert.ok(!bodies.some(b => b.includes(secret)), `response leaked ${secret.slice(0, 8)}`);
    assert.ok(!logs.some(l => l.includes(secret)), `log leaked ${secret.slice(0, 8)}`);
  }
  assert.ok(!logs.some(l => l.includes("synthetic@example.test")), "logs carry no customer email");
});

test("encrypted envelopes are chunked under the browser cookie limit and capped", () => {
  const config = {secureCookies: true};
  const big = "x".repeat(9000);
  const headers = writeChunked(config, "__Host-iqb_ca", big, 3600);
  const live = headers.filter(h => !h.includes("Max-Age=0"));
  assert.equal(live.length, 3);
  for (const h of live) assert.ok(h.split(";")[0].length < 4096);
  const jar = parseCookies(live.map(h => h.split(";")[0]).join("; "));
  assert.equal(readChunked(jar, "__Host-iqb_ca").value, big);
  assert.throws(() => writeChunked(config, "__Host-iqb_ca", "x".repeat(3800 * MAX_CHUNKS + 1), 3600));
  // Shrinking a session expires the now-unused higher chunks.
  assert.ok(writeChunked(config, "__Host-iqb_ca", "small", 3600).some(h => h.startsWith("__Host-iqb_ca.2=;") && h.includes("Max-Age=0")));
});

test("a realistic Shopify-sized session fits in at most two cookies", async () => {
  const {seal} = await import("@/lib/customer-account/crypto");
  const {customerAccountConfig} = await import("@/lib/customer-account/config");
  const {env} = await import("./harness");
  const config = customerAccountConfig(env)!;
  // Generous sizes: shcat_ access token, refresh token and a ~1.2 KB RS256 id_token.
  const session = {v: 1, sid: "s".repeat(32), sub: "gid://shopify/Customer/12345678901234", createdAt: Date.now(), expiresAt: Date.now() + 1e9,
    tokens: {accessToken: `shcat_${"a".repeat(600)}`, refreshToken: `shcrt_${"r".repeat(600)}`, idToken: "i".repeat(1200), accessTokenExpiresAt: Date.now()}};
  const sealed = await seal(config.secret, "session", session);
  const cookies = writeChunked(config, "__Host-iqb_ca", sealed, 3600).filter(h => !h.includes("Max-Age=0"));
  assert.ok(cookies.length <= 2, `${sealed.length} bytes in ${cookies.length} cookies`);
});

test("chunk reader enforces the count and byte budget before decryption", () => {
  const five = parseCookies(Array.from({length: 5}, (_, i) => `__Host-iqb_ca.${i}=${"a".repeat(100)}`).join("; "));
  assert.equal(readChunked(five, "__Host-iqb_ca").value, undefined, "more chunks than the budget");
  const fat = parseCookies(Array.from({length: 4}, (_, i) => `__Host-iqb_ca.${i}=${"a".repeat(3801)}`).join("; "));
  assert.equal(readChunked(fat, "__Host-iqb_ca").value, undefined, "more bytes than the budget");
  const gap = parseCookies(`__Host-iqb_ca.0=${"a".repeat(10)}; __Host-iqb_ca.2=${"b".repeat(10)}`);
  assert.equal(readChunked(gap, "__Host-iqb_ca").value, "a".repeat(10), "assembly stops at the first gap; AES-GCM then rejects the partial envelope");
});

test("if Shopify denies the undocumented subscription fields, pages still work and nothing signs out", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A);
  t.provider.configure({restrictHidden: true});
  const list = await handlers.subscriptionsApi(request("/api/account/subscriptions", a.jar), t.deps);
  assert.equal(list.status, 200);
  const subs = (await list.json()).subscriptions;
  const byId = Object.fromEntries(subs.map((s: {id: string}) => [s.id, s]));
  assert.equal(byId["6101"].eligibility, "unknown");
  assert.deepEqual(byId["6101"].actions, ["pause", "skip", "unskip", "cancel"], "status-based actions; Shopify decides");
  assert.equal(byId["6101"].managedBy, null);
  const detail = await (await handlers.subscriptionApi(request("/api/account/subscriptions/6101", a.jar), "6101", t.deps)).json();
  assert.deepEqual(detail.payment, {kind: "unavailable"});
  // Contract 6103 belongs to another app: Shopify itself refuses the action and the message is surfaced.
  const refused = await handlers.subscriptionActionApi(mutation("/api/account/subscriptions/6103/actions", a.jar, a.csrf, "POST", {action: "pause"}), "6103", t.deps);
  assert.equal(refused.status, 409);
  assert.match((await refused.json()).message, /Not eligible/);
  assert.equal(t.provider.load().customers[CUSTOMER_A].subscriptions.find((s: {id: string}) => s.id.endsWith("/6103")).status, "ACTIVE");
  const ok = await handlers.subscriptionActionApi(mutation("/api/account/subscriptions/6101/actions", a.jar, a.csrf, "POST", {action: "pause"}), "6101", t.deps);
  assert.equal((await ok.json()).status, "PAUSED");
  const session = await handlers.sessionApi(request("/api/account/session", a.jar), t.deps);
  assert.equal((await session.json()).status, "signed_in", "ACCESS_DENIED never ends the session");
});

test("address ids in another GID form still work, and writes use Shopify's exact id", async () => {
  const t = setup();
  const a = await signIn(t, CUSTOMER_A);
  type State = {customers: Record<string, {addresses: {id: string}[]; defaultAddressId: string; orders: Record<string, unknown>[]}>};
  t.provider.mutate((state: State) => {
    const c = state.customers[CUSTOMER_A];
    for (const address of c.addresses) address.id = address.id.replace("CustomerAddress", "MailingAddress") + "?model_name=CustomerAddress";
    c.defaultAddressId = c.addresses[0].id;
    c.orders[0].shippingAddress = {id: "gid://shopify/MailingAddress/55?model_name=Order", firstName: "Avery", lastName: "Synthetic", address1: "100 Mock Street", city: "Austin", zoneCode: "TX", territoryCode: "US", zip: "73301", formatted: ["Avery Synthetic", "100 Mock Street", "Austin TX 73301"]};
  });
  const book = await (await handlers.addressesApi(request("/api/account/addresses", a.jar), t.deps)).json();
  assert.deepEqual(book.addresses.map((x: {id: string}) => x.id), ["8101", "8102"]);
  const updated = await handlers.updateAddressApi(mutation("/api/account/addresses/8102", a.jar, a.csrf, "PATCH", {makeDefault: true}), "8102", t.deps);
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).addresses[0].id, "8102");
  const removed = await handlers.deleteAddressApi(mutation("/api/account/addresses/8101", a.jar, a.csrf, "DELETE", {}), "8101", t.deps);
  assert.deepEqual((await removed.json()).addresses.map((x: {id: string}) => x.id), ["8102"]);
  const order = await handlers.orderApi(request("/api/account/orders/9101", a.jar), "9101", t.deps);
  assert.equal(order.status, 200);
  const detail = await order.json();
  assert.deepEqual(detail.shippingAddress.formatted, ["Avery Synthetic", "100 Mock Street", "Austin TX 73301"]);
  assert.equal(detail.shippingAddress.id, "", "order address snapshots expose no id");
});
