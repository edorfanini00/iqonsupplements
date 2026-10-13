// Pure rules for the storefront advertising choice (lib/ad-privacy.ts).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source = ts.transpile(fs.readFileSync(new URL("../../lib/ad-privacy.ts", import.meta.url), "utf8"), {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022});
const p = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const G = "v1.g.AAAAAAAAAAAAAAAAAAAAAA", D = "v1.d.BBBBBBBBBBBBBBBBBBBBBB";

test("choice cookie format is strict and round-trips", () => {
  assert.deepEqual(p.parseAdChoice(G), {decision: "granted", id: "AAAAAAAAAAAAAAAAAAAAAA"});
  assert.equal(p.formatAdChoice(p.parseAdChoice(D)), D);
  for (const bad of [null, undefined, "", "v1.g.", "v1.g.AAAA", "v1.y.AAAAAAAAAAAAAAAAAAAAAA", "V1.g.AAAAAAAAAAAAAAAAAAAAAA", `${G}x`, "v1.g.AAAAAAAAAAAAAAAAAAAA==", 42]) assert.equal(p.parseAdChoice(bad), null, String(bad));
});

test("cookie header parsing: exact name, restrictive merge, other cookies ignored", () => {
  assert.equal(p.adChoiceFromCookies(null), null);
  assert.equal(p.adChoiceFromCookies(`xiqon_ad_choice=${D}; iqon_ad_choice_old=${D}`), null);
  assert.equal(p.adChoiceFromCookies(`a=1; iqon_ad_choice=${G}`).decision, "granted");
  assert.equal(p.adChoiceFromCookies(`iqon_ad_choice=${G}; iqon_ad_choice=${D}`).decision, "denied");
  assert.equal(p.adChoiceFromCookies(`iqon_ad_choice=${D}; iqon_ad_choice=${G}`).decision, "denied");
  assert.equal(p.adChoiceFromCookies(`iqon_ad_choice=junk; iqon_ad_choice=${G}`).decision, "granted");
  assert.equal(p.choiceKey(null), "none");
  assert.equal(p.choiceKey(p.parseAdChoice(G)), "AAAAAAAAAAAAAAAAAAAAAA");
});

test("restriction and checkout consent: only expressed values, GPC turns marketing and sale of data off, nothing invented", () => {
  const granted = p.parseAdChoice(G), denied = p.parseAdChoice(D);
  assert.equal(p.adRestriction(null, false), null);
  assert.equal(p.adRestriction(null, true), "gpc");
  assert.equal(p.adRestriction(granted, true), "gpc");
  assert.equal(p.adRestriction(denied, true), "denied");
  assert.equal(p.checkoutVisitorConsent(null, false), null);
  assert.deepEqual(p.checkoutVisitorConsent(null, true), {marketing: false, saleOfData: false});
  assert.deepEqual(p.checkoutVisitorConsent(denied, false), {marketing: false, saleOfData: false});
  assert.deepEqual(p.checkoutVisitorConsent(granted, false), {marketing: true, saleOfData: true});
  assert.deepEqual(p.checkoutVisitorConsent(granted, true), {marketing: false, saleOfData: false}, "GPC overrides a stored grant");
  for (const [choice, gpc] of [[null, false], [null, true], [denied, false], [granted, true]]) {
    const consent = p.checkoutVisitorConsent(choice, gpc) || {};
    assert.ok(!("analytics" in consent) && !("preferences" in consent), "analytics/preferences are never expressed here");
  }
});
