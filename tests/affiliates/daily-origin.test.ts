import assert from "node:assert/strict";
import { test } from "node:test";
import { relayAffiliateRequest } from "../../lib/affiliates/shared-relay";

const daily = "https://www.iqondaily.com";
const legacy = "https://www.iqonbody.com";
const env = { NODE_ENV: "production", SHARED_AFFILIATE_HEALTH_ORIGIN: "https://www.iqonhealth.com",
  SHARED_AFFILIATE_PORTAL_ORIGIN: daily, SHARED_AFFILIATE_RELAY_SECRET: "synthetic-local-only-secret-32-characters" };
const request = (host: string, origin = host) => new Request(`${host}/api/affiliates/login`, {
  method: "POST", headers: {origin, "content-type": "application/json", cookie: "iqon_affiliate_wp_jwt=fixture; cart=private"}, body: "{}",
});

test("Daily relay uses verified configured attribution and preserves Health authority", async () => {
  let calls = 0;
  const response = await relayAffiliateRequest(request(daily), {env, fetch: async (url, init) => {
    calls++;
    assert.equal(String(url), "https://www.iqonhealth.com/api/affiliates/login");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("origin"), daily);
    assert.equal(headers.get("x-iqon-portal"), daily);
    assert.equal(headers.get("cookie"), "iqon_affiliate_wp_jwt=fixture");
    return Response.json({ok: true});
  }});
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
});

test("cutover never implicitly trusts legacy, apex, or forged browser origins", async () => {
  for (const [host, origin] of [[legacy, legacy], ["https://iqondaily.com", "https://iqondaily.com"], [daily, legacy], [daily, "https://evil.example"]]) {
    const response = await relayAffiliateRequest(request(host, origin), {env, fetch: async () => {throw Error("must not reach Health");}});
    assert.equal(response.status, 403);
  }
  const response = await relayAffiliateRequest(request(daily), {env: {...env, SHARED_AFFILIATE_PORTAL_ORIGIN: legacy}, fetch: async () => {throw Error("must not reach Health");}});
  assert.equal(response.status, 403, "Daily deployment requires the coordinated external origin change");
  const unavailable = await relayAffiliateRequest(request(daily), {env: {...env, SHARED_AFFILIATE_PORTAL_ORIGIN: ""}});
  assert.equal(unavailable.status, 503, "brand constant is never an implicit authorization origin");
});
