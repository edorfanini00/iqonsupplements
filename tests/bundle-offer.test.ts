import assert from "node:assert/strict";
import { test } from "node:test";
import { BUNDLE_ELIGIBLE_HANDLES, BUNDLE_TIERS, bagSummary, bundleEstimate, bundleNudge, bundleTier, isBundleEligible, tierUnitPrice } from "../lib/bundle-offer";
import { products } from "../lib/catalog";

test("tiers: 2 units save 10%, 3 or more save 25%, and only the best tier applies", () => {
  assert.equal(bundleTier(0), undefined);
  assert.equal(bundleTier(1), undefined);
  assert.equal(bundleTier(2)?.percent, 10);
  for (const units of [3, 4, 7, 20]) assert.equal(bundleTier(units)?.percent, 25);
  assert.deepEqual(BUNDLE_TIERS.map(t => t.title), ["Bundle: Buy 2, save 10%", "Bundle: Buy 3, save 25%"]);
});

test("nudges name the next tier and stop once the top tier is reached", () => {
  assert.equal(bundleNudge(0), null);
  assert.equal(bundleNudge(1), "Add 1 more eligible supplement to save 10%.");
  assert.equal(bundleNudge(2), "Add 1 more eligible supplement to save 25%.");
  assert.equal(bundleNudge(3), null);
  assert.equal(bundleNudge(9), null);
});

test("eligibility: ten supplements that passed the margin gate; Colon Gentle Cleanse and skincare excluded", () => {
  assert.equal(BUNDLE_ELIGIBLE_HANDLES.length, 10);
  for (const handle of ["creatine-monohydrate", "hydrolyzed-collagen-peptides", "colostrum-powder"]) assert.ok(isBundleEligible(handle));
  assert.equal(isBundleEligible("colon-gentle-cleanse"), false);
  for (const p of products.filter(p => p.category === "skincare")) assert.equal(isBundleEligible(p.id), false, p.id);
  const supplements = new Set(products.filter(p => p.category === "supplements").map(p => p.id));
  for (const handle of BUNDLE_ELIGIBLE_HANDLES) assert.ok(supplements.has(handle), `${handle} is a real supplement handle`);
});

test("per unit prices match Shopify's whole-cent discount truncation", () => {
  assert.equal(tierUnitPrice(48.97, 10), 44.08);
  assert.equal(tierUnitPrice(48.97, 25), 36.73);
  assert.equal(tierUnitPrice(65.64, 25), 49.23);
});

test("single product estimates multiply the truncated unit discount by quantity", () => {
  assert.deepEqual(bundleEstimate(48.97, 1), {gross: 48.97, saved: 0, total: 48.97, percent: 0});
  assert.deepEqual(bundleEstimate(48.97, 2), {gross: 97.94, saved: 9.78, total: 88.16, percent: 10});
  assert.deepEqual(bundleEstimate(48.97, 3), {gross: 146.91, saved: 36.72, total: 110.19, percent: 25});
  assert.deepEqual(bundleEstimate(48.97, 5), {gross: 244.85, saved: 61.2, total: 183.65, percent: 25});
  assert.equal(bundleEstimate(30.64, 4).total, 91.92);
});

test("mixed eligible lines truncate independently at the shared quantity tier", () => {
  const twoTier = bundleTier(2)!.percent;
  assert.equal(Math.round(tierUnitPrice(48.97, twoTier) * 100) + Math.round(tierUnitPrice(42.17, twoTier) * 100), 8204);
  const threeTier = bundleTier(3)!.percent;
  assert.equal(2 * Math.round(tierUnitPrice(48.97, threeTier) * 100) + Math.round(tierUnitPrice(42.17, threeTier) * 100), 10509);
});

test("fractional-cent discounts never round up, including half-cent and exact-cent boundaries", () => {
  assert.equal(tierUnitPrice(0.01, 25), 0.01);
  assert.equal(tierUnitPrice(0.02, 25), 0.02);
  assert.equal(tierUnitPrice(0.03, 25), 0.03);
  assert.equal(tierUnitPrice(0.04, 25), 0.03);
  assert.equal(tierUnitPrice(0.05, 10), 0.05);
  assert.equal(tierUnitPrice(0.10, 10), 0.09);
  assert.deepEqual(bundleEstimate(0.03, 3), {gross: 0.09, saved: 0, total: 0.09, percent: 25});
  assert.deepEqual(bundleEstimate(0.04, 3), {gross: 0.12, saved: 0.03, total: 0.09, percent: 25});
});

test("bag summary shows discount rows only when Shopify's own figures reconcile to the cent", () => {
  const lineDiscounts = [{title: "Bundle: Buy 3, save 25%", amount: 36.73}];
  assert.deepEqual(bagSummary({merchandise: 146.91, lineDiscounts, subtotal: 110.18, orderDiscounts: [], total: 110.18}), {showLineDiscounts: true, showOrderDiscounts: false});
  assert.equal(bagSummary({merchandise: 146.91, lineDiscounts, subtotal: 110.19, orderDiscounts: [], total: 110.19}).showLineDiscounts, false, "one cent off hides the breakdown");
  assert.equal(bagSummary({merchandise: 48.97, lineDiscounts: [], subtotal: 48.97, orderDiscounts: [], total: 48.97}).showLineDiscounts, false);
  const orderDiscounts = [{title: "CREATOR", amount: 5}];
  assert.equal(bagSummary({merchandise: 146.91, lineDiscounts, subtotal: 110.18, orderDiscounts, total: 105.18}).showOrderDiscounts, true);
  assert.equal(bagSummary({merchandise: 146.91, lineDiscounts, subtotal: 110.18, orderDiscounts, total: 110.18}).showOrderDiscounts, false);
  // Float sums such as 0.1 + 0.2 must not break reconciliation.
  assert.equal(bagSummary({merchandise: 0.3, lineDiscounts: [{title: "a", amount: 0.1}, {title: "b", amount: 0.2}], subtotal: 0, orderDiscounts: [], total: 0}).showLineDiscounts, true);
});
