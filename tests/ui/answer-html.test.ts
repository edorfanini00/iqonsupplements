// @vitest-environment jsdom
import React from "react";
import { renderToString, renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { products } from "../../lib/catalog";
import { productContent } from "../../lib/product-content";
import { ProductStory } from "../../app/product-story";
import ApproachPage, { metadata as approachMetadata } from "../../app/approach/page";
import { metadata as helpMetadata } from "../../app/help/page";
import { metadata as journalMetadata } from "../../app/journal/page";
import { metadata as reviewsMetadata } from "../../app/reviews/page";
import { generateMetadata as collectionMetadata } from "../../app/collections/[category]/page";
import { metadata as rootMetadata } from "../../app/layout";

const faq = () => React.createElement(Accordion, { type: "single", collapsible: true, defaultValue: "open" },
  React.createElement(AccordionItem, { value: "open" }, React.createElement(AccordionTrigger, null, "Open question"), React.createElement(AccordionContent, null, "Open answer")),
  React.createElement(AccordionItem, { value: "closed" }, React.createElement(AccordionTrigger, null, "Closed question"), React.createElement(AccordionContent, null, "Closed answer")));
const escaped = (text: string) => renderToStaticMarkup(React.createElement("span", null, text)).slice(6, -7);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(cleanup);
describe("answers in the initial HTML", () => {
  it("server-renders closed accordion answers, hidden until opened", () => {
    const html = renderToString(faq());
    expect(html).toContain("Closed answer");
    const closed = new DOMParser().parseFromString(html, "text/html").querySelector('[data-slot="accordion-content"][data-state="closed"]')!;
    expect(closed.textContent).toBe("Closed answer");
    expect(closed.className).toContain("data-[state=closed]:hidden");
    expect(closed.hasAttribute("hidden")).toBe(false);
  });

  it("hydrates without mismatch and then keeps Radix open/close behavior", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(faq());
    document.body.appendChild(container);
    const errors: unknown[] = [];
    await act(async () => { hydrateRoot(container, faq(), { onRecoverableError: error => errors.push(error) }); });
    expect(errors).toEqual([]);
    expect(container.textContent).not.toContain("Closed answer");
    expect(container.querySelector(".data-\\[state\\=closed\\]\\:hidden")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Closed question" })); });
    expect(screen.getByRole("region", { name: "Closed question" }).textContent).toBe("Closed answer");
    expect(container.textContent).not.toContain("Open answer");
    container.remove();
  });

  it("keeps client-only renders identical to the previous accordion", () => {
    render(faq());
    expect(document.body.textContent).toContain("Open answer");
    expect(document.body.textContent).not.toContain("Closed answer");
  });

  it("includes every product FAQ answer and full label details in product HTML", () => {
    for (const product of products) {
      const copy = productContent[product.id];
      const html = renderToString(React.createElement(ProductStory, { product, products }));
      for (const item of copy.faqs) expect(html, `${product.id}: ${item.question}`).toContain(escaped(item.answer));
      if (copy.expectations) expect(html, product.id).toContain(escaped(copy.expectations.body));
      const doc = new DOMParser().parseFromString(html, "text/html");
      const panels = [...doc.querySelectorAll('[data-slot="accordion-content"]')];
      expect(panels.length, product.id).toBe(doc.querySelectorAll('[data-slot="accordion-trigger"]').length);
      for (const panel of panels) expect(panel.textContent?.trim(), product.id).toBeTruthy();
    }
  });
});

describe("page titles and links", () => {
  it("gives storefront pages descriptive titles without overriding the root robots gate", async () => {
    const pages = [approachMetadata, helpMetadata, journalMetadata, reviewsMetadata,
      ...await Promise.all(["all", "supplements", "skincare"].map(category => collectionMetadata({ params: Promise.resolve({ category }) })))];
    const titles = pages.map(page => String(page.title));
    expect(new Set(titles).size).toBe(titles.length);
    for (const page of pages) {
      expect(String(page.title)).toMatch(/\| IQON$/);
      expect(page.description).toBeTruthy();
      expect(page).not.toHaveProperty("robots");
      expect(page).not.toHaveProperty("alternates");
    }
    expect(rootMetadata.robots).toEqual({ index: false, follow: false });
    expect(await collectionMetadata({ params: Promise.resolve({ category: "unknown" }) })).toEqual({});
  });

  it("does not link the approach page to a removed collection anchor", () => {
    const html = renderToStaticMarkup(React.createElement(ApproachPage));
    expect(html).not.toContain("#formats");
    expect(html).toContain('href="/collections/supplements"');
  });
});
