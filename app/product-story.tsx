import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
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
  const formulaInFocus = ["collagen-peptides-chocolate", "colostrum-powder", "glp-1-support", "liver-support", "hair-skin-nails-gummies", "hydra-c-ferulic-serum"].includes(p.id);
  return <div className="product-experience">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">Benefits</a><a href="#product-formula">Ingredients</a>
      {focus && <a href="#formula-story">In detail</a>}
      <a href="#product-routine">How to use</a>{research && <a href="#ingredient-science">Research</a>}
      <a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>
    <section id="product-benefits" className="pdp-benefits-compact pdp-section" aria-labelledby="benefits-heading">
      <div className="pdp-section-heading"><div><p className="eyebrow">{p.name}</p><h2 id="benefits-heading">{content.title}</h2></div></div>
      <ol className="benefit-columns">{content.benefits?.map((benefit, i) => <li key={benefit.title}><span>{String(i + 1).padStart(2, "0")}</span><h3>{benefit.title}</h3><p>{benefit.body}</p></li>)}</ol>
    </section>
    {focus && <section id="formula-story" className={`pdp-focus pdp-focus-${focus.layout} pdp-section`} aria-labelledby="focus-heading"><div className="pdp-focus-intro"><p className="eyebrow">{focus.eyebrow}</p><h2 id="focus-heading">{focus.title}</h2><p>{focus.body}</p>{research && <a className="pdp-text-link" href="#ingredient-science">Explore the research <ArrowUpRight size={16}/></a>}</div><dl className="focus-details">{focus.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd><strong>{row.value}</strong><p>{row.detail}</p></dd></div>)}</dl></section>}
    <section id="product-formula" className={`pdp-formula pdp-section${formulaInFocus ? " pdp-formula-compact" : ""}`} aria-labelledby="formula-heading">
      <div className={formulaInFocus ? "sr-only" : "pdp-section-heading"}><div><p className="eyebrow">THE INGREDIENTS</p><h2 id="formula-heading">Inside the formula.</h2></div>
      </div>
      {!formulaInFocus && <ProductFormulaExplorer key={p.id} product={p}/>}
      <Accordion type="single" collapsible className="pdp-formula-accordion">
        <AccordionItem value="complete-formula"><AccordionTrigger>{supplement ? "View full ingredient statement & listed amounts" : "View ingredients & formulation"}</AccordionTrigger>
          <AccordionContent>{supplement ? <SupplementFormula details={supplement} /> : skin && <><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{content.formulaNote}</p></>}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
    {content.routine && <section id="product-routine" className="pdp-routine pdp-routine-v3 pdp-section" aria-labelledby="routine-heading">
      <div className="pdp-routine-heading"><p className="eyebrow">HOW TO USE</p><h2 id="routine-heading">{visual?.ritualTitle || content.routine.title}</h2>
        {content.guide?.details[2] && <div className="routine-consideration"><h3>{skin ? "Plan your other steps" : "Before you begin"}</h3><p>{content.guide.details[2].body}</p></div>}
      </div>
      <div><ol className="pdp-routine-steps">{content.routine.steps.map((step, i) => <li key={step.title}>
        <span>{String(i + 1).padStart(2, "0")}</span><div><h3>{step.title}</h3><p>{step.body}</p></div>
      </li>)}</ol>
      <Accordion type="single" collapsible className="pdp-directions-accordion"><AccordionItem value="directions">
        <AccordionTrigger>Full directions & care</AccordionTrigger><AccordionContent>{supplement ? <SupplementDirections details={supplement} /> : <p>{skin?.directions}</p>}</AccordionContent>
      </AccordionItem></Accordion>{content.routine.note && <p>{content.routine.note}</p>}</div>
    </section>}
    {research && <section id="ingredient-science" className="pdp-research pdp-section" aria-labelledby="research-heading">
      <div><p className="eyebrow">{research.eyebrow}</p><h2 id="research-heading">{research.title}</h2><p className="pdp-research-scope">{research.scope}</p></div>
      <div><p className="pdp-research-body">{research.body}</p><div className="pdp-research-links">{research.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.label}</span><ArrowUpRight size={18} aria-hidden="true" /></a>)}</div></div>
    </section>}
    <section id="product-questions" className="pdp-questions pdp-section" aria-labelledby="questions-heading">
      <div><p className="eyebrow">A LITTLE MORE CLARITY</p><h2 id="questions-heading">Good questions.<br />Clear answers.</h2>
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
      <div className="pdp-comparison-grid">{comparison.map(q => {
        const qContent = productContent[q.id];
        const size = q.size || supplementDetails[q.id]?.contents || skincareRange.find(item => item.id === q.id)?.size;
        const dailyPrice = dailyProductPrice(q);
        return <article className={p.id === q.id ? "is-current" : ""} key={q.id}>
        {p.id === q.id && <span className="comparison-current">YOU’RE VIEWING</span>}
        <h3><Link href={`/products/${q.id}`}>{q.name}</Link></h3><p>{productContent[q.id]?.descriptor || q.descriptor}</p>
        <dl>{qContent?.comparison && <><div><dt>Focus</dt><dd>{qContent.comparison.focus}</dd></div><div><dt>Routine</dt><dd>{qContent.comparison.routine}</dd></div><div><dt>Key detail</dt><dd>{qContent.comparison.difference}</dd></div></>}
        {size && <div><dt>Contents</dt><dd>{size}</dd></div>}<div><dt>Price</dt><dd>{productPrice(q)}</dd></div>{dailyPrice && <div><dt>Per day*</dt><dd>{dailyPrice}</dd></div>}</dl>
        <Link className="pdp-comparison-link" href={p.id === q.id ? "#overview" : `/products/${q.id}`}>{p.id === q.id ? "Back to product" : "Explore product"}<ArrowUpRight size={17} /></Link>
      </article>})}</div>
      {comparison.some(q => dailyProductPrice(q)) && <p className="pdp-comparison-note">*At the listed price and suggested daily use. Shipping and taxes, where applicable, are calculated at checkout.</p>}
    </section>}
    {supplement && <p className="pdp-disclaimer">*{supplementDisclaimer}</p>}
  </div>;
}
