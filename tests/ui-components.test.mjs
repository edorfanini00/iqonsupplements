import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

async function readCssTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return readCssTree(entryPath);
      }
      return entry.name.endsWith(".css") ? readFile(entryPath, "utf8") : "";
    }),
  );
  return contents.join("\n");
}

test("emits the catalog's animation and scrolling utilities", async () => {
  const css = await readCssTree(path.join(root, "dist"));

  assert.match(css, /--tw-enter-opacity/);
  assert.match(css, /scrollbar-width:\s*thin/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /scroll-fade-reveal-b/);
  assert.match(css, /mask-image:/);
  assert.match(css, /tw-shimmer/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("forwards progress semantics to the primitive", async () => {
  const { Progress } = await vite.ssrLoadModule("/components/ui/progress.tsx");
  const html = renderToStaticMarkup(React.createElement(Progress, { value: 37 }));

  assert.match(html, /aria-valuenow="37"/);
  assert.match(html, /aria-valuetext="37%"/);
  assert.match(html, /data-state="loading"/);
});

test("labels the interactive slider thumb for assistive technology", async () => {
  const { Slider } = await vite.ssrLoadModule("/components/ui/slider.tsx");
  const html = renderToStaticMarkup(React.createElement(Slider, {
    value: [50], "aria-label": "Before and after photo comparison",
  }));
  const thumb = html.match(/<[^>]+role="slider"[^>]*>/)?.[0];
  assert.ok(thumb);
  assert.match(thumb, /aria-label="Before and after photo comparison"/);
});

test("keeps skincare layout samples separate from publishable customer evidence", async () => {
  const { SkinResults, SkincareReviews } = await vite.ssrLoadModule("/app/skincare/skincare-sections.tsx");
  const render = (component,props) => renderToStaticMarkup(React.createElement(component,props));
  assert.equal(render(SkinResults,{results:[],products:[]}),"");
  const publicReviews=render(SkincareReviews,{reviews:[],products:[]});
  assert.doesNotMatch(publicReviews,/skin-review-stars|Design sample|Verified buyer/);
  const draftResults=render(SkinResults,{results:[],products:[],designPreview:true});
  assert.doesNotMatch(draftResults,/AI-GENERATED ILLUSTRATION|skin-comparison-sample-label/);
  assert.match(draftResults,/A CLOSER LOOK/);
  assert.match(draftResults,/Illustrative comparison. Not measured product results/);
  const { sampleSkinResults } = await vite.ssrLoadModule("/lib/skincare-design-preview.ts");
  assert.equal(new Set(sampleSkinResults.flatMap(result => [result.before.src, result.after.src])).size, 8);
  for (const result of sampleSkinResults) {
    assert.equal(result.approvedForPublication, false);
    assert.equal(result.photographyConsentConfirmed, false);
  }
  assert.doesNotMatch(draftResults,/CLINICAL RESULTS|2.1x|83%/);
  const draftReviews=render(SkincareReviews,{reviews:[],products:[],designPreview:true});
  assert.match(draftReviews,/Brand copy · not a customer review/);
  assert.equal((draftReviews.match(/class="skin-review-card/g)||[]).length,8);
  assert.doesNotMatch(draftReviews,/Verified buyer|<video/);
});

test("uses the shared community carousel with supplement-specific content", async () => {
  const { CommunityReviews } = await vite.ssrLoadModule("/app/community-reviews.tsx");
  const props = { reviews:[], products:[], category:"supplements" };
  const preview = renderToStaticMarkup(React.createElement(CommunityReviews, { ...props, designPreview:true }));
  assert.equal((preview.match(/class="skin-review-card/g)||[]).length, 8);
  assert.match(preview, /Previous supplements reviews/);
  assert.match(preview, /href="\/reviews\?collection=supplements"/);
  assert.match(preview, /IQON Creatine Monohydrate/);
  assert.match(preview, /Brand copy · not a customer review/);
  assert.doesNotMatch(preview, /Peptide Serum|Barrier Cream|community-serum|community-cream/);
  const published = renderToStaticMarkup(React.createElement(CommunityReviews, props));
  assert.match(published, /Every routine/);
  assert.doesNotMatch(published, /skin-review-stars|Design sample|Verified buyer/);
});

test("keeps product rating samples out of published customer reviews", async () => {
  const { ProductReviewLink, CustomerReviews } = await vite.ssrLoadModule("/app/customer-reviews.tsx");
  const { products } = await vite.ssrLoadModule("/lib/catalog.ts");
  const { customerReviews } = await vite.ssrLoadModule("/lib/reviews.ts");
  const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
  const counts = new Set();
  for (const product of products) {
    const props = { productId:product.id, productName:product.name };
    const previewLink = render(ProductReviewLink, { ...props, designPreview:true });
    const previewSection = render(CustomerReviews, { ...props, designPreview:true });
    const rating = previewLink.match(/Sample rating: ([\d.]+) out of 5 stars/)?.[1];
    const count = previewLink.match(/(\d+)\+ reviews/)?.[1];
    assert.ok(Number(rating) >= 4.5 && Number(rating) <= 5, product.id);
    assert.ok(Number(count) >= 150, product.id);
    counts.add(count);
    assert.ok(previewSection.includes(`Sample rating: ${rating} out of 5 stars`));
    assert.ok(previewSection.includes(`${count}+ reviews`));
    assert.match(previewLink, /Sample data/);
    assert.match(previewSection, /Sample data/);
    for (const component of [ProductReviewLink, CustomerReviews]) {
      const published = render(component, props);
      assert.match(published, /No customer ratings yet/);
      assert.doesNotMatch(published, /Sample data|\d+\+ reviews/);
    }
  }
  assert.equal(counts.size, products.length);

  const review = { id:"render-test", productId:products[0].id, author:"Test customer", rating:3,
    title:"Test review", text:"Test review body", date:"2026-09-10", verifiedPurchase:false };
  customerReviews.push(review);
  try {
    for (const component of [ProductReviewLink, CustomerReviews]) {
      const html = render(component, { productId:review.productId, designPreview:true });
      assert.match(html, /3.0 out of 5 stars/);
      assert.match(html, /1 review/);
      assert.doesNotMatch(html, /Sample data|\d+\+ reviews/);
    }
  } finally {
    customerReviews.splice(customerReviews.indexOf(review), 1);
  }
});

test("emits chart themes for the starter's media dark mode", async () => {
  const { ChartStyle } = await vite.ssrLoadModule("/components/ui/chart.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ChartStyle, {
      id: "contract",
      config: {
        latency: { theme: { light: "#ffffff", dark: "#000000" } },
      },
    }),
  );

  assert.match(html, /\[data-chart=contract\]/);
  assert.match(html, /@media \(prefers-color-scheme: dark\)/);
  assert.doesNotMatch(html, /\.dark/);
});

test("renders sidebar skeletons deterministically", async () => {
  const { SidebarMenuSkeleton } = await vite.ssrLoadModule(
    "/components/ui/sidebar.tsx",
  );
  const first = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));
  const second = renderToStaticMarkup(React.createElement(SidebarMenuSkeleton));

  assert.equal(first, second);
  assert.match(first, /--skeleton-width:70%/);
});
