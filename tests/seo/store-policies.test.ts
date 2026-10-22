import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createServer } from "node:http";
import { once } from "node:events";
import { STORE_POLICY_LINKS, findStorePolicy } from "../../lib/store-policies";
import { createPolicyLoader, sanitizePolicyBody, POLICY_CACHE_MS, POLICY_FAILURE_CACHE_MS, POLICY_MAX_BYTES, POLICY_TIMEOUT_MS } from "../../lib/store-policy-content.server";

const mappings = [
  ["shipping-policy", "Shipping policy"], ["refund-policy", "Refund policy"],
  ["subscription-policy", "Cancellation policy"], ["terms-of-service", "Terms of service"], ["contact-information", "Contact information"],
];
const response = (slug = "refund-policy", body = "<p>Published policy.</p>") => Response.json({policy: {handle: slug, title: "Published title", body}});

test("all five mappings load the matching published Shopify JSON and preserve sanitized content", async () => {
  assert.equal(STORE_POLICY_LINKS.length, 5);
  for (const [slug, label] of mappings) {
    const policy = findStorePolicy(slug)!;
    assert.equal(policy.label, label);
    assert.equal(policy.href, `/policies/${slug}`);
    assert.equal(policy.fallbackUrl, `https://nr9zd0-t5.myshopify.com/policies/${slug}`);
    let calls = 0;
    const loader = createPolicyLoader(async (url, init) => {
      calls++;
      assert.equal(url, `https://nr9zd0-t5.myshopify.com/policies/${slug}.json`);
      assert.deepEqual(init?.headers, {Accept: "application/json"});
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal instanceof AbortSignal);
      return response(slug, `<p>Published ${slug} &amp; care.</p>`);
    });
    assert.deepEqual(await loader(slug), {title: "Published title", body: `<p>Published ${slug} &amp; care.</p>`});
    assert.equal(calls, 1);
  }
});

test("unknown slugs never make a request", async () => {
  const loader = createPolicyLoader(async () => {throw new Error("must not fetch");});
  for (const slug of ["privacy-policy", "__proto__", "constructor", "../../account", "https://example.com", ""]) {
    assert.equal(findStorePolicy(slug), undefined);
    assert.equal(await loader(slug), null);
  }
});

test("HTTP, network, timeout, malformed, mismatched and empty policies fail closed", async () => {
  const failures: (() => Promise<Response>)[] = [
    async () => new Response("down", {status: 503}), async () => new Response("limited", {status: 429}),
    async () => {throw new Error("network secret must not be logged");},
    async () => {throw new DOMException("Timed out", "TimeoutError");},
    async () => new Response("<html>Shopify theme</html>", {headers: {"Content-Type": "text/html"}}),
    async () => new Response("invalid json", {headers: {"Content-Type": "application/json"}}),
    async () => Response.json({policy: null}), async () => Response.json({policy: {body: "<p>Missing identity</p>"}}),
    async () => response("shipping-policy"), async () => response("refund-policy", " "),
    async () => response("refund-policy", "<p>&nbsp;</p><script>alert(1)</script>"),
    async () => Response.json({policy: {handle: "refund-policy", title: "x".repeat(251), body: "text"}}),
  ];
  for (const fetcher of failures) assert.equal(await createPolicyLoader(fetcher)("refund-policy"), null);
});

test("response size is bounded even without Content-Length; oversized streams are cancelled", async () => {
  let cancelled = false;
  const oversized = () => new Response(new ReadableStream({pull(controller) {controller.enqueue(new Uint8Array(POLICY_MAX_BYTES + 1));}, cancel() {cancelled = true;}}), {headers: {"Content-Type": "application/json"}});
  assert.equal(await createPolicyLoader(async () => oversized())("refund-policy"), null);
  assert.ok(cancelled);
  assert.equal(await createPolicyLoader(async () => new Response("{}", {headers: {"Content-Type": "application/json", "Content-Length": String(POLICY_MAX_BYTES + 1)}}))("refund-policy"), null);
  assert.ok(POLICY_TIMEOUT_MS <= 5000);
});

test("concurrent reads coalesce, content expires, failures replace stale content and retry shortly", async () => {
  let now = 0, calls = 0, failing = false;
  const loader = createPolicyLoader(async () => {calls++; return failing ? new Response("down", {status: 503}) : response();}, () => now);
  const values = await Promise.all([loader("refund-policy"), loader("refund-policy")]);
  assert.deepEqual(values[0], values[1]); assert.equal(calls, 1);
  now = POLICY_CACHE_MS - 1; await loader("refund-policy"); assert.equal(calls, 1);
  now++; failing = true; assert.equal(await loader("refund-policy"), null); assert.equal(calls, 2);
  failing = false; now += POLICY_FAILURE_CACHE_MS - 1; assert.equal(await loader("refund-policy"), null); assert.equal(calls, 2);
  now++; assert.ok(await loader("refund-policy")); assert.equal(calls, 3);
});

test("sanitization removes executable markup, CSS, tracking and unsafe links while keeping accessible policy structure", () => {
  const body = sanitizePolicyBody(`<h1 id="main">Heading</h1><p style="position:fixed" onclick="alert(1)">Read <strong>this</strong>.</p>
    <script>alert(1)</script><style>body{display:none}</style><iframe srcdoc="bad"></iframe><form><input name="password"></form><svg onload="alert(1)"></svg><img src="https://tracker.test" onerror="alert(1)">
    <a href="jav&#x61;script:alert(1)">bad</a><a href="data:text/html,bad">data</a><a href="//tracker.test" ping="https://tracker.test">relative</a>
    <a href="mailto:info@example.com" target="_blank">email</a><a href="https://nr9zd0-t5.myshopify.com/policies/refund-policy">returns</a>
    <a href="https://example.com/secure-manager?token=synthetic">manager</a><ul><li>First</li></ul>`);
  const doc = new JSDOM(body).window.document;
  assert.equal(doc.querySelector("script,style,iframe,form,input,svg,img,h1,[style],[onclick],[id],[target],[ping]"), null);
  assert.equal(doc.querySelector("h2")?.textContent, "Heading");
  assert.equal(doc.querySelector("strong")?.textContent, "this");
  const links = [...doc.querySelectorAll("a")].map(a => a.getAttribute("href"));
  assert.deepEqual(links, [null, null, null, "mailto:info@example.com", "/policies/refund-policy", "https://example.com/secure-manager?token=synthetic"]);
  assert.equal(doc.querySelector("li")?.textContent, "First");
});


test("the fetch deadline also aborts a stalled response body", async t => {
  const server = createServer((_req, res) => {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.write('{"policy":');
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {server.closeAllConnections(); server.close();});
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const loader = createPolicyLoader((_url, init) => fetch(`http://127.0.0.1:${address.port}`, init));
  const started = Date.now();
  assert.equal(await loader("refund-policy"), null);
  assert.ok(Date.now() - started < POLICY_TIMEOUT_MS + 2500);
});
