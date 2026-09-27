// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { products } from "../../lib/catalog";
import { productVisuals } from "../../lib/product-visuals";
import { ProductGallery } from "../../app/product-gallery";
import { ProductFormulaExplorer } from "../../app/product-formula-explorer";

afterEach(cleanup);
describe("visual product guides", () => {
  it("provides five meaningful panels for every product, with working expanded views", () => {
    for (const product of products) {
      const view = render(React.createElement(ProductGallery, { product }));
      expect(view.container.querySelectorAll('.visual-gallery-item').length).toBeGreaterThanOrEqual(5);
      expect(screen.getAllByText(productVisuals[product.id].fact.label).length).toBe(1);
      for (const image of view.container.querySelectorAll('img')) expect(image.getAttribute('src')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: `Enlarge formula focus for ${product.name}` }));
      expect(screen.getByRole('dialog').textContent).toContain(productVisuals[product.id].fact.body);
      cleanup();
    }
  });
  it("moves through the mobile gallery and preserves additional Shopify images", () => {
    Object.defineProperty(window, 'matchMedia', { configurable:true, value:vi.fn(() => ({ matches:true })) });
    HTMLElement.prototype.scrollTo = vi.fn();
    const p = { ...products.find(p => p.id === 'nmn')!, images:[{src:'/first.webp',alt:'First'}, {src:'/second.webp',alt:'Second'}, {src:'/third.webp',alt:'Third Shopify image'}] };
    const { container } = render(React.createElement(ProductGallery, {product:p}));
    expect(screen.getByRole('button', {name:'Previous product panel'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', {name:'Next product panel'}));
    expect(screen.getByRole('button', {name:'View why choose it'}).getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(screen.getByRole('region'), {key:'ArrowLeft'});
    expect(screen.getByRole('button', {name:'View the product'}).getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('img[alt="Third Shopify image"]')?.getAttribute('src')).toBe('/third.webp');
  });
  it("changes ingredient panels with the keyboard and keeps their labels connected", () => {
    const p = products.find(p => p.id === 'hydra-c-ferulic-serum')!;
    render(React.createElement(ProductFormulaExplorer, {product:p}));
    const tabs = screen.getAllByRole('tab');
    expect(screen.getByRole('tabpanel').textContent).toContain('Ascorbic acid');
    fireEvent.keyDown(tabs[0], {key:'ArrowRight'});
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[1].id);
    expect(screen.getByRole('tabpanel').textContent).toContain('Ferulic acid');
  });
});
