import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root,
  resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
after(() => vite.close());
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const escaped = text => renderToStaticMarkup(React.createElement("span", null, text)).slice(6, -7);

test("every catalog product renders useful education with working section links", async () => {
  const { products } = await vite.ssrLoadModule("/lib/catalog.ts");
  const { productContent } = await vite.ssrLoadModule("/lib/product-content.ts");
  const { ProductStory } = await vite.ssrLoadModule("/app/product-story.tsx");
  assert.equal(products.length, 18);
  for (const product of products) {
    const copy = productContent[product.id];
    assert.ok(copy.benefits.length >= 3, product.id);
    assert.ok(copy.ingredients.length > 0, product.id);
    assert.ok(copy.routine.steps.length >= 2, product.id);
    const html = render(ProductStory, { product, products });
    for (const link of html.matchAll(/href="#([^"]+)"/g)) {
      if (link[1] !== "reviews") assert.ok(html.includes(`id="${link[1]}"`), `${product.id}: ${link[1]}`);
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${product.id}: duplicate anchors`);
    assert.ok(html.includes(escaped(copy.title)), product.id);
    assert.doesNotMatch(html, /clinically proven IQON|guaranteed results|lorem ipsum/i);
    for (const benefit of copy.benefits) assert.ok(html.includes(escaped(benefit.body)), product.id);
  }
});

test("full supplement information preserves ingredients, allergens and label directions", async () => {
  const { supplementDetails } = await vite.ssrLoadModule("/lib/supplement-details.ts");
  const { SupplementFormula, SupplementDirections } = await vite.ssrLoadModule("/app/supplement-information.tsx");
  for (const [id, details] of Object.entries(supplementDetails)) {
    const formula = render(SupplementFormula, { details });
    assert.ok(formula.includes(escaped(details.ingredients)), `${id}: full ingredients`);
    for (const allergen of details.allergens || []) assert.ok(formula.includes(escaped(allergen)), id);
    const directions = render(SupplementDirections, { details });
    for (const text of [...details.directions, ...details.cautions, details.storage]) {
      assert.ok(directions.includes(escaped(text)), `${id}: directions and care`);
    }
  }
});

test("comparisons keep live prices and unique products, with the viewed product first", async () => {
  const { products } = await vite.ssrLoadModule("/lib/catalog.ts");
  const { comparisonFor, ProductStory } = await vite.ssrLoadModule("/app/product-story.tsx");
  const live = products.map(product => ({ ...product, price: 91.25, currency: "EUR" }));
  for (const product of live) {
    const comparison = comparisonFor(product, live);
    assert.equal(comparison[0].id, product.id);
    assert.equal(new Set(comparison.map(item => item.id)).size, comparison.length);
    assert.ok(comparison.every(item => item.price === 91.25 && item.currency === "EUR"));
    assert.ok(render(ProductStory, { product, products: live }).includes("91.25"));
  }
});

test("all product pages keep illustrative ratings out of published reviews", async () => {
  const { products } = await vite.ssrLoadModule("/lib/catalog.ts");
  const { ProductReviewLink, CustomerReviews } = await vite.ssrLoadModule("/app/customer-reviews.tsx");
  for (const product of products) {
    for (const component of [ProductReviewLink, CustomerReviews]) {
      const html = render(component, { productId: product.id, productName: product.name });
      assert.match(html, /No customer ratings yet/);
      assert.doesNotMatch(html, /Sample rating|\d+\+ reviews|Verified purchase/);
    }
  }
});
