// @vitest-environment jsdom
import React from "react";
import { renderToString, renderToStaticMarkup } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { products } from "../../lib/catalog";
import { productContent } from "../../lib/product-content";
import { ProductStory } from "../../app/product-story";
import ApproachPage, { generateMetadata as approachMetadata } from "../../app/approach/page";
import { generateMetadata as helpMetadata } from "../../app/help/page";
import { generateMetadata as journalMetadata } from "../../app/journal/page";
import { metadata as reviewsMetadata } from "../../app/reviews/page";
import { generateMetadata as collectionMetadata } from "../../app/collections/[category]/page";
import { metadata as rootMetadata } from "../../app/layout";
import { generateMetadata as skincareHomeMetadata } from "../../app/skincare/page";

// Request scope for generateMetadata: the canonical host with a live catalog.
const request = vi.hoisted(() => ({host: "www.iqondaily.com"}));
vi.mock("next/headers", () => ({headers: async () => new Headers({host: request.host}), cookies: async () => new Map()}));
vi.mock("@/lib/shopify.server", () => ({getStoreCatalog: async () => ({mode: "live", products: [], currency: "USD"})}));

const faq = () => React.createElement(Accordion, { type: "single", collapsible: true, defaultValue: "open" },
  React.createElement(AccordionItem, { value: "open" }, React.createElement(AccordionTrigger, null, "Open question"), React.createElement(AccordionContent, null, "Open answer")),
  React.createElement(AccordionItem, { value: "closed" }, React.createElement(AccordionTrigger, null, "Closed question"), React.createElement(AccordionContent, null, "Closed answer")));
const escaped = (text: string) => renderToStaticMarkup(React.createElement("span", null, text)).slice(6, -7);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(cleanup);
describe("answers in the initial HTML", () => {
  const closedClasses = ["data-[state=closed]:h-0", "data-[state=closed]:invisible"];
  const closedPanel = (root: ParentNode) => root.querySelector<HTMLElement>('[data-slot="accordion-content"][data-state="closed"]')!;

  it("server-renders closed accordion answers, collapsed and hidden until opened", () => {
    const html = renderToString(faq());
    const closed = closedPanel(new DOMParser().parseFromString(html, "text/html"));
    expect(closed.textContent).toBe("Closed answer");
    for (const name of closedClasses) expect(closed.className).toContain(name);
    expect(closed.className).not.toContain("iqon-accordion-up");
  });

  it("keeps closed answers in the hydrated DOM with Radix open/close and ARIA relationships", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(faq());
    document.body.appendChild(container);
    const errors: unknown[] = [];
    await act(async () => { hydrateRoot(container, faq(), { onRecoverableError: error => errors.push(error) }); });
    expect(errors).toEqual([]);
    const trigger = screen.getByRole("button", { name: "Closed question" });
    const panel = closedPanel(container);
    expect(panel.textContent).toBe("Closed answer");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.hasAttribute("aria-controls")).toBe(false);
    expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    for (const name of closedClasses) expect(panel.className).toContain(name);
    expect(panel.className).toContain("data-[state=closed]:animate-[iqon-accordion-up_0.2s_ease-out]");
    await act(async () => { fireEvent.click(trigger); });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("data-state")).toBe("open");
    expect(screen.getByRole("region", { name: "Closed question" }).textContent).toBe("Closed answer");
    const previouslyOpen = screen.getByRole("button", { name: "Open question" });
    expect(previouslyOpen.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Open answer");
    expect(closedPanel(container).textContent).toBe("Open answer");
    container.remove();
  });

  it("keeps closed answers mounted in client-only renders", () => {
    render(faq());
    expect(closedPanel(document.body).textContent).toBe("Closed answer");
    expect(screen.getByRole("button", { name: "Closed question" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("hides closed panels with compiled CSS that keeps them visible only while collapsing", () => {
    const css = readFileSync(`${process.cwd()}/app/globals.css`, "utf8");
    expect(css).toMatch(/@keyframes iqon-accordion-up\{from\{height:var\(--radix-accordion-content-height,auto\);visibility:visible\}to\{height:0;visibility:visible\}\}/);
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
  const publicPages = async () => [await approachMetadata(), await helpMetadata(), await journalMetadata(), await skincareHomeMetadata(),
    ...await Promise.all(["all", "supplements", "skincare"].map(category => collectionMetadata({ params: Promise.resolve({ category }) })))];

  it("gives storefront pages descriptive titles and a www canonical; only the canonical production host is indexable", async () => {
    const previous = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = "production";
      const pages = await publicPages();
      const titles = [...pages, reviewsMetadata].map(page => String(page.title));
      expect(new Set(titles).size).toBe(titles.length);
      for (const page of pages) {
        expect(String(page.title)).toMatch(/\| IQON$/);
        expect(page.description).toBeTruthy();
        expect(page.robots).toEqual({ index: true, follow: true });
        expect(String(page.alternates?.canonical)).toMatch(/^https:\/\/www\.iqondaily\.com\//);
      }
      request.host = "www.iqonbody.com";
      for (const page of await publicPages()) expect(page.robots).toEqual({ index: false, follow: true });
      request.host = "www.iqondaily.com";
      process.env.VERCEL_ENV = "preview";
      for (const page of await publicPages()) expect(page.robots).toEqual({ index: false, follow: true });
    } finally {
      request.host = "www.iqondaily.com";
      if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous;
    }
    // Anything that does not opt in, including /reviews (no published reviews yet), keeps the root noindex.
    expect(reviewsMetadata).not.toHaveProperty("robots");
    expect(rootMetadata.robots).toEqual({ index: false, follow: false });
    expect(await collectionMetadata({ params: Promise.resolve({ category: "unknown" }) })).toEqual({});
  });

  it("does not link the approach page to a removed collection anchor", () => {
    const html = renderToStaticMarkup(React.createElement(ApproachPage));
    expect(html).not.toContain("#formats");
    expect(html).toContain('href="/collections/supplements"');
  });
});
