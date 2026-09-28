// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { existsSync } from "node:fs";
import { SkincareIngredientExplorer } from "../../app/skincare-ingredient-explorer";
import { skincareVisualContent } from "../../lib/skincare-visual-content";
import { productContent } from "../../lib/product-content";

afterEach(cleanup);
describe("skincare ingredient exploration",()=>{
  it("keeps all ingredient summaries visible and updates the selected artwork and explanation",()=>{
    const id="hydra-c-ferulic-serum";
    const ingredients=productContent[id].ingredients!;
    render(React.createElement(SkincareIngredientExplorer,{ingredients,visuals:skincareVisualContent[id].ingredients}));
    const panel=screen.getByRole('region',{name:'Ingredient spotlight'});
    expect(within(panel).getByRole('img').getAttribute('src')).toContain('vitamin-c.svg');
    const ferulic=screen.getByRole('button',{name:'Explore Ferulic acid'});
    fireEvent.click(ferulic);
    expect(ferulic.getAttribute('aria-pressed')).toBe('true');
    expect(within(panel).getByRole('img').getAttribute('src')).toContain('ferulic-acid.svg');
    expect(panel.textContent).toContain(ingredients[1].detail);
    expect(screen.getByRole('button',{name:'Explore Vitamin C'}).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button',{name:'Explore Sodium hyaluronate'})).toBeTruthy();
  });
  it("provides matching ingredient artwork for every skincare formula",()=>{
    expect(Object.keys(skincareVisualContent)).toHaveLength(7);
    for(const [id,content] of Object.entries(skincareVisualContent)){
      expect(content.ingredients).toHaveLength(productContent[id].ingredients!.length);
      for(const visual of content.ingredients)if(visual.kind==='molecule'){
        expect(existsSync(`public/images/skincare-ingredients/${visual.art}.svg`)).toBe(true);
      }
    }
  });
});
