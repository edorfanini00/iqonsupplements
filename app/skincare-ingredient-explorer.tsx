"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import type { IngredientVisual } from "@/lib/skincare-visual-content";

/** Conceptual ingredient-family artwork is separate from the sourced molecular diagrams. */
export function IngredientArtwork({visual,compact=false}:{visual:IngredientVisual;compact?:boolean}) {
  if(visual.imageSrc||visual.kind==="molecule") return <img className="skin-molecule" src={visual.imageSrc||`/images/skincare-ingredients/${visual.art}.svg`} alt={compact?"":`${visual.kind==="molecule"?"Molecular structure of":"Illustration of"} ${visual.artLabel}`} width={520} height={360} loading="lazy"/>;
  return <svg className={`skin-ingredient-artwork art-${visual.kind}`} viewBox="0 0 520 360" fill="none" aria-hidden="true">
    {visual.kind==="peptide"&&<>
      <path d="M91 245 160 144 245 225 323 110 413 176" stroke="currentColor" strokeWidth="2"/>
      <path d="m160 144-16-57m101 138 16 59m62-174 16-47" stroke="currentColor" strokeWidth="1.4" opacity=".5"/>
      {[[91,245,26],[160,144,34],[245,225,29],[323,110,32],[413,176,24]].map(([x,y,r],i)=><g key={i}><circle cx={x} cy={y} r={r+7} stroke="currentColor" strokeWidth=".6" opacity=".35"/><circle cx={x} cy={y} r={r} fill="currentColor" fillOpacity={i%2===0?.86:.13} stroke="currentColor" strokeWidth="1.3"/></g>)}
      {[[144,87],[261,284],[339,63]].map(([x,y])=><circle key={x} cx={x} cy={y} r="8" fill="currentColor" fillOpacity=".5"/>)}
    </>}
    {visual.kind==="moisture"&&<>
      <path d="M75 190q47-85 94 0t94 0t94 0t94 0" stroke="currentColor" strokeWidth="2"/>
      {[[125,112],[220,250],[315,110],[410,254]].map(([x,y],i)=><g key={x}><path d={`M${x} ${y}v${i%2?'-38':'38'}`} stroke="currentColor" strokeDasharray="3 5"/><circle cx={x} cy={y} r="23" stroke="currentColor" fill="currentColor" fillOpacity=".07"/><circle cx={x-7} cy={y-6} r="4" fill="currentColor" fillOpacity=".3"/></g>)}
      {[75,169,263,357,451].map(x=><circle key={x} cx={x} cy="190" r="6" fill="currentColor"/>)}
    </>}
    {visual.kind==="emollient"&&<>
      {[0,1,2].map(i=><g key={i} transform={`translate(0 ${i*49})`}><path d="M94 152q63-33 126-8t207-8" stroke="currentColor" strokeWidth={i===0?2:1} opacity={1-i*.2}/>{[121,174,234,298,363,415].map((x,j)=><ellipse key={x} cx={x} cy={i===0?131+(j%2)*8:137+(j%2)*8} rx="19" ry="9" fill="currentColor" fillOpacity={i===0?.12:.06} stroke="currentColor" strokeWidth=".7"/>)}</g>)}
    </>}
    {visual.kind==="botanical"&&<>
      <path d="M249 290C128 214 164 105 248 54c81 54 126 159 1 236Z" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity=".05"/>
      <path d="m249 290-1-204m1 162-57-46m57 9 60-48m-61 4-41-37m42 8 35-32" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="361" cy="250" r="32" stroke="currentColor" strokeWidth="1"/><circle cx="361" cy="250" r="22" stroke="currentColor" strokeWidth=".6"/>
    </>}
  </svg>;
}

export function SkincareIngredientExplorer({ingredients,visuals}:{ingredients:{name:string;role:string;detail:string}[];visuals:IngredientVisual[]}) {
  const [selected,setSelected]=useState(0);
  const panelId=useId();
  const active=visuals[selected];
  const ingredient=ingredients[selected];
  return <div className="skin-formula-explorer">
    <div className="skin-formula-art-panel" id={panelId} role="region" aria-label="Ingredient spotlight" aria-live="polite">
      <div className="skin-art-topline"><span>INGREDIENT SPOTLIGHT</span><span>0{selected+1} / 0{ingredients.length}</span></div>
      <div className="skin-art-stage"><IngredientArtwork visual={active}/></div>
      <div className="skin-art-caption"><span>{active.kind==="molecule"?"MOLECULAR STRUCTURE":"INGREDIENT ROLE / ILLUSTRATION"}</span><strong>{active.artLabel}</strong></div>
      <div className="skin-art-detail"><h3>{ingredient.name}</h3><p>{ingredient.detail}</p></div>
    </div>
    <div className="skin-formula-plus" aria-hidden="true"><span/><Plus size={26} strokeWidth={1}/><span/></div>
    <div className="skin-ingredient-selections">
      <p className="skin-kicker">EACH INGREDIENT HAS A ROLE</p>
      {ingredients.map((item,i)=><article key={item.name} className={selected===i?"is-selected":""}>
        <button aria-label={`Explore ${item.name}`} aria-pressed={selected===i} aria-controls={panelId} onClick={()=>setSelected(i)}>
          <span className="skin-ingredient-thumbnail"><IngredientArtwork visual={visuals[i]} compact/></span>
          <span className="skin-ingredient-short"><span className="skin-ingredient-name">{visuals[i].label||item.name}</span><span className="skin-ingredient-summary">{visuals[i].summary}</span><span className="skin-ingredient-tags">{visuals[i].tags.map(tag=><span key={tag}>{tag}</span>)}</span></span>
          <ArrowUpRight size={17} strokeWidth={1.25} className="skin-ingredient-arrow"/>
        </button>
      </article>)}
      <p className="skin-explore-hint">Select an ingredient to take a closer look.</p>
    </div>
  </div>;
}
