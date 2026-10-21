// Guide ↔ collection ↔ product links and the shared shipping statement. Pure functions over catalog data;
// the rendered pages are covered by route-matrix.test.mjs and the layout e2e.
//
//   node --import tsx --test tests/seo/buyer-paths.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { SHIPPING_NOTE, isOrderable } from "../../lib/commerce-policy";
import { orderableFormats, productGuides, sectionFact, sectionProducts } from "../../lib/buyer-paths";
import { products as editorialProducts, type Product } from "../../lib/catalog";
import { formatOrder } from "../../lib/departments";
import { journalArticles } from "../../lib/journal";
import { productContent } from "../../lib/product-content";
import { supplementDetails } from "../../lib/supplement-details";

// The editorial catalog as Shopify returns it live: each supplement with one available variant.
const liveVariant = (p: Product) => [{id: `gid://shopify/ProductVariant/${p.id}`, title: "Default Title", price: p.price, currency: "USD", available: true}];
const live: Product[] = editorialProducts.map(p => ({...p, available: p.category === "supplements", variants: liveVariant(p)}));
const sections = journalArticles.flatMap(article => article.sections.map(section => ({article, section})));
const linked = sections.filter(({section}) => section.format || section.products);

test("orderable means live, not coming soon or unpriced, with an available variant", () => {
  const creatine = live.find(p => p.id === "creatine-monohydrate")!;
  assert.equal(isOrderable(creatine, "live"), true);
  for (const mode of ["preview", "unavailable"]) assert.equal(isOrderable(creatine, mode), false, mode);
  assert.equal(isOrderable({...creatine, variants: []}, "live"), false, "editorial placeholder");
  assert.equal(isOrderable({...creatine, variants: [{...creatine.variants![0], available: false}]}, "live"), false, "sold out");
  assert.equal(isOrderable({...creatine, available: false}, "live"), false);
  assert.equal(isOrderable({...creatine, pricePending: true}, "live"), false);
  const skincare = live.find(p => p.category === "skincare")!;
  assert.equal(isOrderable({...skincare, available: true}, "live"), false, "coming-soon skincare");
});

test("guide sections name real formats and handles, and each has an orderable product live", () => {
  assert.ok(linked.length >= 6);
  for (const {article, section} of linked) {
    if (section.format) assert.ok(formatOrder.includes(section.format), section.format);
    for (const id of section.products || []) assert.ok(editorialProducts.some(p => p.id === id && p.category === "supplements"), id);
    const list = sectionProducts(section, live, "live");
    assert.ok(list.length > 0, `${article.slug}: ${section.heading}`);
    for (const p of list) {
      assert.equal(p.category, "supplements");
      if (section.format) assert.equal(p.type, section.format);
      // Only facts the product page already publishes.
      const fact = sectionFact(section, p);
      assert.ok(fact, `${p.id}: fact`);
      assert.equal(fact, section.format ? supplementDetails[p.id].contents : productContent[p.id].comparison!.difference);
    }
  }
  assert.ok(sections.filter(({section}) => !section.format && !section.products).every(({section}) => sectionProducts(section, live, "live").length === 0));
});

test("guide product links fail closed for preview, outage, sold-out, placeholder and skincare products", () => {
  for (const {section} of linked) {
    assert.deepEqual(sectionProducts(section, live, "preview"), []);
    assert.deepEqual(sectionProducts(section, [], "unavailable"), []);
    assert.deepEqual(sectionProducts(section, live.map(p => ({...p, variants: p.variants!.map(v => ({...v, available: false}))})), "live"), []);
    assert.deepEqual(sectionProducts(section, live.map(p => ({...p, variants: []})), "live"), []);
  }
  const powder = linked.find(({section}) => section.format === "Powder")!.section;
  const withoutCreatine = live.map(p => p.id === "creatine-monohydrate" ? {...p, available: false} : p);
  assert.ok(!sectionProducts(powder, withoutCreatine, "live").some(p => p.id === "creatine-monohydrate"));
  const skinAsPowder = live.map(p => p.category === "skincare" ? {...p, type: "Powder", available: true} : p);
  assert.ok(sectionProducts(powder, skinAsPowder, "live").every(p => p.category === "supplements"));
});

test("product pages link back to exactly the guides that link to them", () => {
  for (const p of live) {
    const guides = productGuides(p).map(g => g.slug).sort();
    const linking = [...new Set(linked.filter(({section}) => sectionProducts(section, live, "live").some(x => x.id === p.id)).map(({article}) => article.slug))].sort();
    assert.deepEqual(guides, linking, p.id);
    if (p.category === "skincare") assert.deepEqual(guides, [], p.id);
  }
  // Every live supplement has a format with a guide section.
  for (const p of live.filter(p => p.category === "supplements")) assert.ok(productGuides(p).some(g => g.slug === "finding-your-supplement-format"), p.id);
  assert.deepEqual(productGuides(live.find(p => p.id === "creatine-monohydrate")!).map(g => g.slug).sort(), ["finding-your-supplement-format", "reading-a-supplement-label"]);
});

test("format selection lists only formats that can be ordered now", () => {
  assert.deepEqual(orderableFormats(live, "live"), ["Powder", "Capsules", "Sachets", "Gummies"]);
  assert.deepEqual(orderableFormats(live, "preview"), []);
  assert.deepEqual(orderableFormats(live.map(p => p.type === "Gummies" ? {...p, available: false} : p), "live"), ["Powder", "Capsules", "Sachets"]);
});

test("the shipping statement makes no delivery-time or policy promise", () => {
  assert.match(SHIPPING_NOTE, /shown at checkout/);
  assert.doesNotMatch(SHIPPING_NOTE, /\d|business day|guarantee|free|refund|return/i);
});
