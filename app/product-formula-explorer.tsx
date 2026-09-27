"use client";
import { useState } from "react";
import { type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";

export function ProductFormulaExplorer({ product }: { product: Product }) {
  const ingredients = productContent[product.id]?.ingredients || [];
  const [active, setActive] = useState(0);
  if (!ingredients.length) return null;
  return <div className="formula-explorer">
    <div className="formula-tabs" role="tablist" aria-label="Explore the ingredients">{ingredients.map((item, i) => <button key={item.name} role="tab" id={`formula-tab-${i}`} aria-controls={`formula-panel-${i}`} aria-selected={active === i} tabIndex={active === i ? 0 : -1}
      onClick={() => setActive(i)} onKeyDown={e => { let next = active; if (e.key === "ArrowRight") next = (active + 1) % ingredients.length; else if (e.key === "ArrowLeft") next = (active + ingredients.length - 1) % ingredients.length; else if (e.key === "Home") next = 0; else if (e.key === "End") next = ingredients.length - 1; else return; e.preventDefault(); setActive(next); (e.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus(); }}>
      <span>{String(i + 1).padStart(2, "0")}</span>{item.name}</button>)}</div>
    {ingredients.map((item, i) => <div key={item.name} role="tabpanel" id={`formula-panel-${i}`} aria-labelledby={`formula-tab-${i}`} hidden={active !== i} className="formula-panel" tabIndex={0}>
      <div className="formula-feature"><span className="eyebrow">{item.role}</span><h3>{item.name}</h3>{item.amount && <strong>{item.amount}</strong>}</div>
      <div className="formula-explanation"><p>{item.detail}</p></div>
    </div>)}
  </div>;
}
