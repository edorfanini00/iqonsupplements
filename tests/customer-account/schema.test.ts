// Every document this site sends is validated against the published Customer Account API
// schema (from @shopify/hydrogen-react 2026.4.4, API 2026-04; sha256 of the uncompressed
// JSON 4d0e9a179058d23d8fe18356f26b9af86dc190781195f87618e3c30e6c8a74ec).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { test } from "node:test";
import { buildClientSchema, parse, validate, type IntrospectionQuery } from "graphql";
import { ALL_OPERATIONS } from "@/lib/customer-account/operations";
import { DEFAULT_API_VERSION } from "@/lib/customer-account/config";

const raw = gunzipSync(readFileSync(new URL("./fixtures/customer-account-2026-04.schema.json.gz", import.meta.url)));
const schema = buildClientSchema((JSON.parse(raw.toString()) as {data?: IntrospectionQuery}).data ?? JSON.parse(raw.toString()));

test("schema fixture is the pinned provider schema", () => {
  assert.equal(createHash("sha256").update(raw).digest("hex"), "4d0e9a179058d23d8fe18356f26b9af86dc190781195f87618e3c30e6c8a74ec");
  assert.equal(DEFAULT_API_VERSION, "2026-04");
});

for (const [name, document] of Object.entries(ALL_OPERATIONS)) {
  test(`${name} is valid against the Customer Account API schema`, () => {
    assert.deepEqual(validate(schema, parse(document)).map(error => error.message), []);
  });
}

test("negative control: an invented frequency mutation is rejected by the schema", () => {
  const errors = validate(schema, parse(`mutation { subscriptionContractUpdateFrequency(subscriptionContractId: "gid://shopify/SubscriptionContract/1", interval: WEEK) { userErrors { message } } }`));
  assert.ok(errors.length > 0);
});

test("customer-scoped roots only: no Admin API fields are used", () => {
  for (const document of Object.values(ALL_OPERATIONS)) assert.doesNotMatch(document, /\b(customers|customerByIdentifier|shopifyPaymentsAccount|orders\(query)/);
});

test("core documents avoid fields missing from Shopify's public 2026-10 reference", async () => {
  const {OPTIONAL_OPERATIONS} = await import("@/lib/customer-account/operations");
  // Present in the introspection schema, absent from shopify.dev 2026-04/07/10 reference pages.
  const undocumented = /\b(appEligibleForCustomerActions|paymentInstrument|sellingPlan)\b|\bapp \{/;
  for (const [name, document] of Object.entries(ALL_OPERATIONS)) {
    const operation = /(?:query|mutation)\s+(\w+)/.exec(document)![1];
    if (OPTIONAL_OPERATIONS.has(operation)) continue;
    assert.doesNotMatch(document, undocumented, name);
  }
});
