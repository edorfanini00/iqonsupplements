import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUNDLE_ELIGIBLE_HANDLES, BUNDLE_TIERS, SKINCARE_BUNDLE_ELIGIBLE_HANDLES, SKINCARE_BUNDLE_TIERS,
  bundleEstimate, bundleFamily, bundleNudge, bundleNudges, bundleTier, bundleUnits, isBundleEligible, tierUnitPrice,
} from "../lib/bundle-offer";
import { products } from "../lib/catalog";
import { activeSkincareIds } from "../lib/skincare-identity";

// Owner decision 10 Nov 2026: an independent skincare bundle (Buy 2 save 10%, Buy 3+ save 15%)
// across exactly the eight active skincare handles. Supplements keep 10% / 25%.
const SKINCARE = ["enzyme-gel-cleanser", "exfoliating-pads", "hyaluronic-serum", "retinol-rx", "hydra-c-ferulic-serum",
  "peptide-anti-wrinkle-day-cream", "copper-peptide-restore-cream", "firming-peptide-eye-gel"];
const once = (id: string, quantity = 1) => ({id, quantity, purchase: "once" as const});

test("skincare tiers: exactly 2 → 10% and 3+ → 15%, with the exact Shopify automatic discount titles", () => {
  assert.deepEqual(SKINCARE_BUNDLE_TIERS.map(t => [t.minQuantity, t.percent, t.title]),
    [[2, 10, "Skincare bundle: Buy 2, save 10%"], [3, 15, "Skincare bundle: Buy 3, save 15%"]]);
  assert.equal(bundleTier(0, "skincare"), undefined);
  assert.equal(bundleTier(1, "skincare"), undefined);
  assert.equal(bundleTier(2, "skincare")?.percent, 10);
  for (const units of [3, 4, 7, 20]) assert.equal(bundleTier(units, "skincare")?.percent, 15);
});

test("supplement tiers, titles and handles are unchanged by the skincare family", () => {
  assert.deepEqual(BUNDLE_TIERS.map(t => [t.minQuantity, t.percent, t.title]),
    [[2, 10, "Bundle: Buy 2, save 10%"], [3, 25, "Bundle: Buy 3, save 25%"]]);
  assert.equal(bundleTier(3)?.percent, 25);
  assert.equal(bundleTier(3, "supplements")?.percent, 25);
  assert.equal(BUNDLE_ELIGIBLE_HANDLES.length, 11);
  assert.deepEqual(bundleEstimate(48.97, 3), {gross: 146.91, saved: 36.72, total: 110.19, percent: 25});
  assert.equal(bundleNudge(1), "Add 1 more eligible supplement to save 10%.");
  assert.equal(bundleNudge(2), "Add 1 more eligible supplement to save 25%.");
});

test("skincare eligibility is exactly the eight active handles and never crosses families", () => {
  assert.deepEqual([...SKINCARE_BUNDLE_ELIGIBLE_HANDLES].sort(), [...SKINCARE].sort());
  assert.deepEqual([...SKINCARE_BUNDLE_ELIGIBLE_HANDLES].sort(), [...activeSkincareIds].sort());
  for (const id of SKINCARE) {
    assert.equal(bundleFamily(id), "skincare", id);
    assert.equal(isBundleEligible(id, "skincare"), true, id);
    assert.equal(isBundleEligible(id, "supplements"), false, id);
    assert.equal(isBundleEligible(id), false, `${id}: the default family is supplements`);
  }
  for (const id of BUNDLE_ELIGIBLE_HANDLES) {
    assert.equal(bundleFamily(id), "supplements", id);
    assert.equal(isBundleEligible(id, "skincare"), false, id);
  }
  // Legacy, retired, unapproved and unknown handles belong to no bundle.
  for (const id of ["anti-aging-cleanser-with-peptides", "hydrating-tonic", "colon-gentle-cleanse", "unapproved-test-skincare", "", "RETINOL-RX", "retinol-rx ", "daily-travel-kit"]) {
    assert.equal(bundleFamily(id), undefined, JSON.stringify(id));
    assert.equal(isBundleEligible(id, "skincare"), false);
    assert.equal(isBundleEligible(id, "supplements"), false);
  }
  const skincare = new Set(products.filter(p => p.category === "skincare").map(p => p.id));
  for (const id of SKINCARE_BUNDLE_ELIGIBLE_HANDLES) assert.ok(skincare.has(id), `${id} is a real skincare handle`);
});

test("skincare unit prices and estimates use Shopify's whole-cent truncation at the approved prices", () => {
  assert.equal(tierUnitPrice(99, 10), 89.1);
  assert.equal(tierUnitPrice(99, 15), 84.15);
  assert.equal(tierUnitPrice(77, 10), 69.3);
  assert.equal(tierUnitPrice(77, 15), 65.45);
  assert.equal(tierUnitPrice(55, 15), 46.75);
  assert.equal(tierUnitPrice(68, 15), 57.8);
  assert.deepEqual(bundleEstimate(99, 1, "skincare"), {gross: 99, saved: 0, total: 99, percent: 0});
  assert.deepEqual(bundleEstimate(99, 2, "skincare"), {gross: 198, saved: 19.8, total: 178.2, percent: 10});
  assert.deepEqual(bundleEstimate(99, 3, "skincare"), {gross: 297, saved: 44.55, total: 252.45, percent: 15});
  assert.deepEqual(bundleEstimate(77, 5, "skincare"), {gross: 385, saved: 57.75, total: 327.25, percent: 15});
  // A supplement price never borrows the skincare 15% and vice versa.
  assert.equal(bundleEstimate(48.97, 3, "supplements").percent, 25);
  assert.equal(bundleEstimate(99, 3, "skincare").percent, 15);
});

test("skincare nudges name the next skincare tier with the right plural and stop at the top tier", () => {
  assert.equal(bundleNudge(0, "skincare"), null);
  assert.equal(bundleNudge(1, "skincare"), "Add 1 more skincare product to save 10%.");
  assert.equal(bundleNudge(2, "skincare"), "Add 1 more skincare product to save 15%.");
  assert.equal(bundleNudge(3, "skincare"), null);
  assert.equal(bundleNudge(12, "skincare"), null);
});

test("bag units are counted per family: mixed bags never cross families; subscriptions and unknown handles never count", () => {
  const bag = [once("retinol-rx"), once("creatine-monohydrate"), once("gut-health", 1), once("firming-peptide-eye-gel", 2),
    {id: "colostrum-powder", quantity: 4, purchase: "subscription" as const}, {id: "hyaluronic-serum", quantity: 3, purchase: "subscription" as const},
    once("anti-aging-cleanser-with-peptides", 5), once("unapproved-test-supplement", 6)];
  assert.equal(bundleUnits(bag, "skincare"), 3);
  assert.equal(bundleUnits(bag, "supplements"), 2);
  assert.equal(bundleUnits([], "skincare"), 0);
  // One skincare item plus one supplement reaches neither tier.
  assert.deepEqual(bundleNudges([once("retinol-rx"), once("creatine-monohydrate")]), [
    {family: "supplements", message: "Add 1 more eligible supplement to save 10%."},
    {family: "skincare", message: "Add 1 more skincare product to save 10%."},
  ]);
  // Multi-quantity single line reaches the tier on its own.
  assert.deepEqual(bundleNudges([once("retinol-rx", 2)]), [{family: "skincare", message: "Add 1 more skincare product to save 15%."}]);
  assert.deepEqual(bundleNudges([once("retinol-rx", 3), once("creatine-monohydrate", 3)]), []);
  // Boundary: two skincare units and two supplement units, each on its own family's tier.
  assert.deepEqual(bundleNudges([once("retinol-rx"), once("enzyme-gel-cleanser"), once("nmn", 2)]), [
    {family: "supplements", message: "Add 1 more eligible supplement to save 25%."},
    {family: "skincare", message: "Add 1 more skincare product to save 15%."},
  ]);
  // Subscriptions and unknown handles produce no skincare nudge.
  assert.deepEqual(bundleNudges([{id: "retinol-rx", quantity: 1, purchase: "subscription"}, once("hydrating-tonic")]), []);
});
