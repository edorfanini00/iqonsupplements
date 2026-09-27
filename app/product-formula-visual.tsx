import type { FormulaSpotlight } from "@/lib/product-story-detail";

/** Editorial schematics describe ingredient roles, never molecular structure or clinical outcomes. */
export function ProductFormulaVisual({ data }: { data: FormulaSpotlight }) {
  return <figure className={`formula-visual formula-visual-${data.design}`}>
    <div className="formula-visual-heading"><p>{data.label}</p><h3>{data.title}</h3><span>{data.form}</span></div>
    <div className={`formula-schema schema-${data.design}`} aria-hidden="true">
      {data.symbols.map((symbol,i)=><span key={`${symbol}-${i}`}><i/>{symbol}</span>)}
    </div>
    <dl className="formula-visual-parts">{data.parts.map(part=><div key={part.name}><dt>{part.name}</dt><dd>{part.role}</dd></div>)}</dl>
    <figcaption>{data.caption}</figcaption>
  </figure>;
}

export function IngredientMark({ name, index }: { name:string; index:number }) {
  const lower = name.toLowerCase();
  const type = /retinol/.test(lower) ? "encapsulated" : /hyaluron|glycerin|pca/.test(lower) ? "water" : /peptide|collagen|immunoglob/.test(lower) ? "peptide" : /vitamin|biotin|niacinamide|panthenol/.test(lower) ? "vitamin" : /acid/.test(lower) ? "acid" : /capsule|hypromellose/.test(lower) ? "capsule" : /ginger|cocoa|stevia|aloe|artichoke|tea|coffee|milk thistle|turmeric|botanical|raspberry|root/.test(lower) ? "botanical" : "compound";
  return <div className={`ingredient-mark ingredient-mark-${type}`} aria-hidden="true">
    {type === "encapsulated" ? <span className="mark-encapsulation"><i/><i/><i/></span> :
    type === "water" ? <svg viewBox="0 0 100 100"><path d="M50 17C40 34 27 43 27 59a23 23 0 0 0 46 0C73 43 60 34 50 17Z"/><path d="M37 60c0 8 5 13 12 14"/></svg> :
    type === "peptide" ? <svg viewBox="0 0 100 100"><path d="m23 61 19-29 21 34 18-30"/>{[[23,61],[42,32],[63,66],[81,36]].map(([cx,cy])=><circle key={cx} cx={cx} cy={cy} r="8"/>)}</svg> :
    type === "acid" ? <span className="mark-letters">{lower.includes('salicylic')?'BHA':lower.includes('mandelic')?'AHA':lower.includes('ferulic')?'FA':'A'}</span> :
    type === "vitamin" ? <span className="mark-letters">{lower.includes('vitamin c')?'C':lower.includes('niacinamide')?'B3':lower.includes('panthenol')?'B5':lower.includes('biotin')?'B':'A–E'}</span> :
    type === "capsule" ? <svg viewBox="0 0 100 100"><g transform="rotate(-35 50 50)"><rect x="15" y="33" width="70" height="34" rx="17"/><path d="M50 33v34"/></g></svg> :
    type === "botanical" ? <svg viewBox="0 0 100 100"><path d="M27 74c-3-35 14-53 48-50 2 34-15 52-48 50Z"/><path d="m27 74 40-40m-22 7v15m11 6 14-1"/></svg> :
    <svg viewBox="0 0 100 100">{[[32,32],[68,32],[32,68],[68,68]].map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="11"/>)}</svg>}
    <small>{String(index+1).padStart(2,"0")}</small>
  </div>;
}
