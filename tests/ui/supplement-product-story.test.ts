// @vitest-environment jsdom
import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { products } from "../../lib/catalog";
import { productContent } from "../../lib/product-content";
import { supplementDetails, supplementDisclaimer } from "../../lib/supplement-details";
import { supplementVisualContent } from "../../lib/supplement-visual-content";
import { ProductStory, comparisonFor } from "../../app/product-story";

afterEach(cleanup);
const supplements=products.filter(p=>supplementDetails[p.id]);

describe("the complete supplement range",()=>{
  it("has a distinct photograph and a complete content path for all 11 formulas",()=>{
    expect(supplements).toHaveLength(11);
    expect(new Set(Object.keys(supplementVisualContent))).toEqual(new Set(supplements.map(p=>p.id)));
    const hashes=[];
    for(const p of supplements){
      const photo=readFileSync(`public/images/supplement-materials-v1/${p.id}.webp`);
      expect(photo.length).toBeGreaterThan(10000);
      expect(photo.toString('ascii',8,12)).toBe('WEBP');
      hashes.push(createHash('sha256').update(photo).digest('hex'));
      const visual=supplementVisualContent[p.id];
      expect(visual.ingredients).toHaveLength(productContent[p.id].ingredients!.length);
      for(const art of visual.ingredients) expect(existsSync(`public${art.imageSrc}`)).toBe(true);
    }
    expect(new Set(hashes).size).toBe(11);
  });

  it.each(supplements.map(p=>[p.id]))("renders %s with its formula, directions, artwork and relevant comparisons",(id)=>{
    const p=supplements.find(p=>p.id===id)!;
    const content=productContent[id];
    const detail=supplementDetails[id];
    const visual=supplementVisualContent[id];
    const {container}=render(React.createElement(ProductStory,{product:p,products}));
    expect(container.querySelector('.supplement-pdp-story')).toBeTruthy();
    expect(screen.getByRole('heading',{name:visual.title})).toBeTruthy();
    expect(container.querySelector('.skin-benefits-photo img')?.getAttribute('src')).toBe(`/images/supplement-materials-v1/${id}.webp`);
    expect(container.querySelectorAll('.skin-benefit-points article')).toHaveLength(4);
    expect(container.querySelectorAll('.skin-application-steps li')).toHaveLength(3);
    for(const nav of container.querySelectorAll('.pdp-section-nav a')){
      const anchor=nav.getAttribute('href')!;
      if(anchor!=='#reviews') expect(container.querySelector(anchor)).toBeTruthy();
    }
    const panel=screen.getByRole('region',{name:'Ingredient spotlight'});
    for(const [i,ingredient] of content.ingredients!.entries()){
      if(content.ingredients!.length>1){
        const button=screen.getByRole('button',{name:`Explore ${ingredient.name}`});
        fireEvent.click(button);expect(button.getAttribute('aria-pressed')).toBe('true');
      }
      expect(within(panel).getByRole('heading').textContent).toBe(ingredient.name);
      expect(panel.textContent).toContain(ingredient.detail);
      expect(within(panel).getByRole('img').getAttribute('src')).toBe(visual.ingredients[i].imageSrc);
      if(ingredient.amount) expect(panel.textContent).toContain(ingredient.amount);
    }
    fireEvent.click(screen.getByRole('button',{name:'Ingredients, listed amounts & allergen details'}));
    expect(container.textContent).toContain(detail.ingredients);
    for(const row of detail.amounts||[]) expect(container.textContent).toContain(row.amount);
    for(const allergen of detail.allergens||[]) expect(container.textContent).toContain(allergen);
    fireEvent.click(screen.getByRole('button',{name:'Read the complete directions & care'}));
    for(const direction of [...detail.directions,...detail.cautions]) expect(container.textContent).toContain(direction);
    expect(container.textContent).toContain(supplementDisclaimer);
    const comparison=comparisonFor(p,products);
    expect(comparison[0].id).toBe(id);
    expect(new Set(comparison.map(p=>p.id)).size).toBe(comparison.length);
    const compare=screen.getByRole('region',{name:'Compare supplement formulas'});
    expect(within(compare).getAllByRole('img')).toHaveLength(comparison.length);
    if(content.education){
      expect(container.textContent).toContain(content.education.scope);
      for(const source of content.education.sources) expect(screen.getByRole('link',{name:source.label}).getAttribute('href')).toBe(source.url);
    }
  });

  it("does not present included ingredient percentages as extra doses or clinical results",()=>{
    expect(supplementVisualContent['colostrum-powder'].composition?.percent).toBe(25);
    expect(supplementVisualContent['colostrum-powder'].composition?.note).toContain('part of the total serving');
    expect(supplementVisualContent.resveratrol.composition?.percent).toBe(50);
    expect(supplementVisualContent.resveratrol.composition?.note).toContain('whole complex');
    expect(supplementVisualContent['glp-1-support'].ingredients[1].summary).toContain('does not provide a CFU count');
  });

  it("keeps the approved skincare renderer for all seven skincare products",()=>{
    for(const p of products.filter(p=>p.category==='skincare')){
      const {container}=render(React.createElement(ProductStory,{product:p,products}));
      expect(container.querySelector('.skincare-pdp-story')).toBeTruthy();
      expect(container.querySelector('.supplement-pdp-story')).toBeNull();
      cleanup();
    }
  });
});
