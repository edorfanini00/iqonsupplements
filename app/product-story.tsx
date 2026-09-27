import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { productPrice, type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { supplementDetails, supplementDisclaimer } from "@/lib/supplement-details";
import skincareRange from "@/lib/skincare-range.json";
import { SupplementFormula, SupplementDirections } from "./supplement-information";
import { dailyProductPrice } from "./product-essentials";
import { productVisuals } from "@/lib/product-visuals";
import { productPresentation } from "@/lib/product-presentation";
import { ProductFormulaExplorer } from "./product-formula-explorer";
import { formulaSpotlights, skincareNotes } from "@/lib/product-story-detail";
import { ProductFormulaVisual } from "./product-formula-visual";

export function comparisonFor(product: Product, products: Product[]) {
  const choices = product.category === "skincare"
    ? ["hydra-c-ferulic-serum", "retinol-rx", "exfoliating-pads"].includes(product.id)
      ? ["hydra-c-ferulic-serum", "retinol-rx", "exfoliating-pads"]
      : ["anti-aging-cleanser-with-peptides", "hydrating-tonic", "copper-peptide-restore-cream"].includes(product.id)
        ? ["anti-aging-cleanser-with-peptides", "hydrating-tonic", "copper-peptide-restore-cream"]
        : ["firming-peptide-eye-gel", "hydrating-tonic", "copper-peptide-restore-cream"]
    : ["nmn", "resveratrol"].includes(product.id)
      ? ["nmn", "resveratrol"]
      : ["hydrolyzed-collagen-peptides", "collagen-peptides-chocolate"].includes(product.id)
        ? ["hydrolyzed-collagen-peptides", "collagen-peptides-chocolate"]
        : product.type === "Powder"
          ? ["creatine-monohydrate", "hydrolyzed-collagen-peptides", "colostrum-powder"]
          : ["glp-1-support", "hair-skin-nails-gummies", "colon-gentle-cleanse"];
  return [product.id, ...choices.filter(id => id !== product.id)]
    .map(id => products.find(p => p.id === id))
    .filter((p): p is Product => Boolean(p)).slice(0, 3);
}

export function ProductStory({ product: p, products }: { product: Product; products: Product[] }) {
  const content = productContent[p.id];
  if (!content) return null;
  const supplement = supplementDetails[p.id];
  const skin = skincareRange.find(item => item.id === p.id);
  const comparison = comparisonFor(p, products);
  const research = content.education;
  const visual = productVisuals[p.id];
  const focus = productPresentation[p.id]?.focus;
  const spotlight = formulaSpotlights[p.id];
  const notes = skincareNotes[p.id];
  return <div className="product-experience product-story-v4">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">Benefits</a><a href="#product-formula">Ingredients</a>
      {focus && <a href="#formula-story">In detail</a>}
      <a href="#product-routine">How to use</a>{research && <a href="#ingredient-science">Research</a>}
      <a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>
    <section id="product-benefits" className="story-overview pdp-section" aria-labelledby="benefits-heading">
      <div className="story-benefit-copy"><p className="eyebrow">{p.name} / THE BENEFITS</p><h2 id="benefits-heading">{content.title}</h2>
        <p className="story-introduction">{visual?.whyBody || content.story}</p>
        <ol className="story-benefit-list">{content.benefits?.map((benefit, i) => <li key={benefit.title}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{benefit.title}</h3><p>{benefit.body}</p></div></li>)}</ol>
      </div>
      {spotlight && <ProductFormulaVisual data={spotlight}/>}
      {content.fit && <dl className="story-fit-strip">{content.fit.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
    </section>
    <section id="product-formula" className="story-ingredients pdp-section" aria-labelledby="formula-heading">
      <div className="story-section-heading"><div><p className="eyebrow">THE INGREDIENTS</p><h2 id="formula-heading">Every ingredient has a role.</h2></div><p>A closer look at the key ingredients in {p.name}, and what each brings to the formula.</p>
      </div>
      <ProductFormulaExplorer key={p.id} product={p}/>
      {notes ? <div id="formula-story" className="story-formula-notes" aria-label="Details that matter">{notes.map(note=><article key={note.title}><h3>{note.title}</h3><p>{note.body}</p></article>)}</div> : focus && <div id="formula-story" className="story-formula-notes" aria-label={focus.title}>{focus.rows.map(row=><article key={row.label}><p className="eyebrow">{row.label}</p><h3>{row.value}</h3><p>{row.detail}</p></article>)}</div>}
      <Accordion type="single" collapsible className="pdp-formula-accordion">
        <AccordionItem value="complete-formula"><AccordionTrigger>{supplement ? "View full ingredient statement & listed amounts" : "View ingredients & formulation"}</AccordionTrigger>
          <AccordionContent>{supplement ? <SupplementFormula details={supplement} /> : skin && <><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{content.formulaNote}</p></>}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
    {content.routine && <section id="product-routine" className="story-routine pdp-section" aria-labelledby="routine-heading">
      <div className="story-section-heading"><div><p className="eyebrow">HOW TO USE</p><h2 id="routine-heading">{visual?.ritualTitle || content.routine.title}</h2></div><p>{content.guide?.introduction || content.description}</p>
      </div>
      <ol className="story-routine-steps">{content.routine.steps.map((step, i) => <li key={step.title}>
        <span>{String(i + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.body}</p></div>
      </li>)}</ol>
      <div className="story-routine-footer">{!skin && content.guide?.details[2] && <p><strong>Before you begin</strong>{content.guide.details[2].body}</p>}<div>
      <Accordion type="single" collapsible className="pdp-directions-accordion"><AccordionItem value="directions">
        <AccordionTrigger>Full directions & care</AccordionTrigger><AccordionContent>{supplement ? <SupplementDirections details={supplement} /> : <p>{skin?.directions}</p>}</AccordionContent>
      </AccordionItem></Accordion>{content.routine.note && <p>{content.routine.note}</p>}</div>
      </div>
    </section>}
    {research && <section id="ingredient-science" className="pdp-research pdp-section" aria-labelledby="research-heading">
      <div><p className="eyebrow">{research.eyebrow}</p><h2 id="research-heading">{research.title}</h2><p className="pdp-research-scope">{research.scope}</p></div>
      <div><p className="pdp-research-body">{research.body}</p><div className="pdp-research-links">{research.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.label}</span><ArrowUpRight size={18} aria-hidden="true" /></a>)}</div></div>
    </section>}
    <section id="product-questions" className="pdp-questions pdp-section" aria-labelledby="questions-heading">
      <div><p className="eyebrow">A LITTLE MORE CLARITY</p><h2 id="questions-heading">Good questions. Clear answers.</h2>
        <p>Still wondering about something?</p><Link className="pdp-text-link" href="/help">We’re here to help <ArrowUpRight size={17} /></Link>
      </div>
      <Accordion type="single" collapsible className="pdp-faq-list">
        {content.expectations && <AccordionItem value="expectations"><AccordionTrigger>{content.expectations.title}</AccordionTrigger><AccordionContent>{content.expectations.body}</AccordionContent></AccordionItem>}
        {content.faqs.map((faq, i) => <AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger>{faq.question}</AccordionTrigger><AccordionContent>{faq.answer}</AccordionContent></AccordionItem>)}
      </Accordion>
    </section>
    {comparison.length > 1 && <section id="compare" className="pdp-comparison pdp-section" aria-labelledby="comparison-heading">
      <div className="pdp-section-heading"><div><p className="eyebrow">A CLEARER CHOICE</p><h2 id="comparison-heading">Compare the formulas.</h2></div>
        <Link className="pdp-text-link" href={`/collections/${p.category}`}>Explore {p.category}<ArrowUpRight size={17} /></Link>
      </div>
      <div className="story-comparison-scroll" role="region" aria-label="Product formula comparison" tabIndex={0}>
        <table className="story-comparison-table"><caption className="sr-only">Compare the focus, routine and price of related {p.category}</caption>
          <thead><tr><th scope="col">Find your fit</th>{comparison.map(q=><th scope="col" className={p.id === q.id ? "is-current" : ""} key={q.id}>{p.id === q.id && <span className="comparison-current">YOU’RE VIEWING</span>}<Link href={`/products/${q.id}`}>{q.name}</Link></th>)}</tr></thead>
          <tbody>{[
            {label:"Focus",value:(q:Product)=>productContent[q.id]?.comparison?.focus || q.descriptor},
            {label:"Routine",value:(q:Product)=>productContent[q.id]?.comparison?.routine || "Follow product directions"},
            {label:"Key ingredients",value:(q:Product)=>productContent[q.id]?.comparison?.difference || "See ingredient statement"},
            {label:"Contents",value:(q:Product)=>q.size || supplementDetails[q.id]?.contents || skincareRange.find(item=>item.id===q.id)?.size || "See packaging"},
            {label:"Price",value:(q:Product)=>productPrice(q)},
            ...(comparison.some(q=>dailyProductPrice(q)) ? [{label:"Per day*",value:(q:Product)=>dailyProductPrice(q) || "—"}] : [])
          ].map(row=><tr key={row.label}><th scope="row">{row.label}</th>{comparison.map(q=><td className={p.id===q.id?"is-current":""} key={q.id}>{row.value(q)}</td>)}</tr>)}
          <tr className="comparison-actions"><th scope="row"><span className="sr-only">Explore</span></th>{comparison.map(q=><td className={p.id===q.id?"is-current":""} key={q.id}><Link href={p.id===q.id?"#overview":`/products/${q.id}`}>{p.id===q.id?"Back to product":"Explore product"}<ArrowUpRight size={15}/></Link></td>)}</tr></tbody>
        </table>
      </div>
      {comparison.some(q => dailyProductPrice(q)) && <p className="pdp-comparison-note">*At the listed price and suggested daily use. Shipping and taxes, where applicable, are calculated at checkout.</p>}
    </section>}
    {supplement && <p className="pdp-disclaimer">*{supplementDisclaimer}</p>}
  </div>;
}
