"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { IngredientArtwork } from "./skincare-ingredient-explorer";
import type { IngredientVisual } from "@/lib/skincare-visual-content";
import type { SupplementVisualContent } from "@/lib/supplement-visual-content";

type Ingredient={name:string;role:string;detail:string;amount?:string};

export function SupplementIngredientExplorer({ingredients,visuals,facts}:{ingredients:Ingredient[];visuals:IngredientVisual[];facts:SupplementVisualContent["facts"]}) {
  const [selected,setSelected]=useState(0);
  const panelId=useId();
  const single=ingredients.length===1;
  const active=visuals[selected];
  const ingredient=ingredients[selected];
  return <div className={`skin-formula-explorer supplement-explorer ingredient-count-${ingredients.length}`}>
    <div className="skin-formula-art-panel" id={panelId} role="region" aria-label="Ingredient spotlight" aria-live="polite">
      <div className="skin-art-topline"><span>INGREDIENT SPOTLIGHT</span><span>0{selected+1} / 0{ingredients.length}</span></div>
      <div className="skin-art-stage"><IngredientArtwork visual={active}/></div>
      <div className="skin-art-caption"><span>{active.kind==="molecule"?"MOLECULAR STRUCTURE":"FORMULA ILLUSTRATION / NOT TO SCALE"}</span><strong>{active.artLabel}</strong></div>
      <div className="skin-art-detail"><h3>{ingredient.name}</h3>{ingredient.amount&&<span className="supp-ingredient-amount">{ingredient.amount}</span>}<p>{ingredient.detail}</p></div>
    </div>
    <div className="skin-formula-plus" aria-hidden="true"><span/><Plus size={26} strokeWidth={1}/><span/></div>
    {single?<div className="supp-single-ingredient"><p className="skin-kicker">THE COMPLETE FORMULA, AT A GLANCE</p><dl>{facts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd><strong>{fact.value}</strong><span>{fact.detail}</span></dd></div>)}</dl></div>:<div className="skin-ingredient-selections">
      <p className="skin-kicker">GET TO KNOW THE FORMULA</p>
      {ingredients.map((item,i)=><article key={item.name} className={selected===i?"is-selected":""}>
        <button aria-label={`Explore ${item.name}`} aria-pressed={selected===i} aria-controls={panelId} onClick={()=>setSelected(i)}>
          <span className="skin-ingredient-thumbnail"><IngredientArtwork visual={visuals[i]} compact/></span>
          <span className="skin-ingredient-short"><span className="skin-ingredient-name">{visuals[i].label||item.name}</span><span className="skin-ingredient-summary">{visuals[i].summary}</span><span className="skin-ingredient-tags">{visuals[i].tags.map(tag=><span key={tag}>{tag}</span>)}</span></span>
          <ArrowUpRight size={17} strokeWidth={1.25} className="skin-ingredient-arrow"/>
        </button>
      </article>)}
      <p className="skin-explore-hint">Select an ingredient to take a closer look.</p>
    </div>}
  </div>;
}
