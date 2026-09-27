// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { products } from "../../lib/catalog";
import { productPresentation } from "../../lib/product-presentation";
import { ProductGallery } from "../../app/product-gallery";
import { ProductFormulaExplorer } from "../../app/product-formula-explorer";

afterEach(cleanup);
describe("visual product guides", () => {
  it("restores the original lead, unique details and exact facts with working expanded views", () => {
    for (const product of products) {
      const view = render(React.createElement(ProductGallery, { product }));
      expect(view.container.querySelectorAll('.visual-gallery-item').length).toBeGreaterThanOrEqual(4);
      expect(view.container.querySelector('img')?.getAttribute('src')).toBe(product.image);
      const sources = Array.from(view.container.querySelectorAll('img')).map(image => image.getAttribute('src'));
      expect(new Set(sources).size).toBe(sources.length);
      for (const image of view.container.querySelectorAll('img')) expect(image.getAttribute('src')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: `Enlarge formula focus for ${product.name}` }));
      expect(screen.getByRole('dialog').textContent).toContain(productPresentation[product.id].note);
      cleanup();
    }
  });
  it("moves through the mobile gallery and preserves additional Shopify images", () => {
    Object.defineProperty(window, 'matchMedia', { configurable:true, value:vi.fn(() => ({ matches:true })) });
    HTMLElement.prototype.scrollTo = vi.fn();
    const p = { ...products.find(p => p.id === 'nmn')!, size:'', images:[{src:'/first.webp',alt:'First'}, {src:'/second.webp',alt:'Second'}, {src:'/third.webp',alt:'Third Shopify image'}] };
    const { container } = render(React.createElement(ProductGallery, {product:p}));
    expect(screen.getByRole('button', {name:'Previous product panel'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', {name:'Next product panel'}));
    expect(screen.getByRole('button', {name:'View the daily ritual'}).getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(screen.getByRole('region'), {key:'ArrowLeft'});
    expect(screen.getByRole('button', {name:'View the packaging'}).getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('img[alt="Third Shopify image"]')?.getAttribute('src')).toBe('/third.webp');
    expect(screen.getByText('30 capsules')).toBeTruthy();
  });
  it('uses a distinct detail photograph for each product', () => {
    const details = products.map(product => productPresentation[product.id].detail);
    expect(new Set(details).size).toBe(products.length);
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
