// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { products } from "../../lib/catalog";
import { productPresentation } from "../../lib/product-presentation";
import { galleryGuides } from "../../lib/product-gallery-content";
import { ProductGallery } from "../../app/product-gallery";
import { ProductFormulaExplorer } from "../../app/product-formula-explorer";

afterEach(cleanup);
describe("visual product guides", () => {
  it("keeps approved packaging, excludes rejected photos and expands exact facts", () => {
    for (const product of products) {
      const view = render(React.createElement(ProductGallery, { product }));
      expect(view.container.querySelectorAll('.visual-gallery-item').length).toBeGreaterThanOrEqual(4);
      expect(view.container.querySelector('img')?.getAttribute('src')).toBe(product.image);
      const sources = Array.from(view.container.querySelectorAll('img')).map(image => image.getAttribute('src'));
      expect(new Set(sources).size).toBe(sources.length);
      expect(sources.every(src => !/product-details|product-campaign-v2|17_hero_nmn_hand/.test(src || ''))).toBe(true);
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
    expect(screen.getByRole('button', {name:'View formula focus'}).getAttribute('aria-current')).toBe('true');
    fireEvent.keyDown(screen.getByRole('region'), {key:'ArrowLeft'});
    expect(screen.getByRole('button', {name:'View the packaging'}).getAttribute('aria-current')).toBe('true');
    expect(container.querySelector('img[alt="Third Shopify image"]')?.getAttribute('src')).toBe('/third.webp');
    expect(screen.getByText('30 capsules')).toBeTruthy();
  });
  it('uses product-specific guides with the relevant instructions in the expanded view', () => {
    for (const product of products) {
      render(React.createElement(ProductGallery, { product }));
      fireEvent.click(screen.getByRole('button', {name:`Enlarge how it fits for ${product.name}`}));
      expect(screen.getByRole('dialog').textContent).toContain(galleryGuides[product.id].note);
      cleanup();
    }
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
