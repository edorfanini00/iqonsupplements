import type { ProductPresentation } from "@/lib/product-presentation";

/** Exact, accessible typography and label data. Never generated clinical charts. */
export function ProductFactArt({ data }: { data: ProductPresentation }) {
  return <div className={`product-fact-art fact-art-${data.diagram}`}>
    <p className="fact-kicker">{data.kicker}</p>
    <h3>{data.title}</h3>
    <div className="fact-art-center">
      {data.diagram === "composition" ? <div className="composition-ring" role="img" aria-label={`${data.fact} ${data.factLabel}`} style={{ background: `conic-gradient(#d6dfe1 0 ${data.percentage}%, #556066 ${data.percentage}% 100%)` }}><div><strong>{data.fact}</strong><span>{data.factLabel}</span></div></div> : <div className="fact-art-value"><strong className={data.fact.length > 7 ? "is-long" : undefined}>{data.fact}</strong><span>{data.factLabel}</span></div>}
      <ol className="fact-art-labels">{data.labels.map((label, i) => <li key={label}><span aria-hidden="true">{data.diagram === "steps" ? String(i+1).padStart(2,"0") : ""}</span>{label}</li>)}</ol>
    </div>
    <p className="fact-art-note">{data.note}</p>
  </div>;
}
