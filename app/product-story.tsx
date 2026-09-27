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
  return <div className="product-experience">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">Benefits</a><a href="#product-formula">Ingredients</a>
      {visual && <a href="#formula-story">How it works</a>}
      <a href="#product-routine">How to use</a>{research && <a href="#ingredient-science">Research</a>}
      <a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>
    <section id="product-benefits" className="pdp-benefits-v3 pdp-section" aria-labelledby="benefits-heading">
      <div className="benefits-introduction"><p className="eyebrow">{skin ? "YOUR SKIN, CONSIDERED" : "A PURPOSE IN YOUR ROUTINE"}</p><h2 id="benefits-heading">{visual?.whyTitle || content.title}</h2><p>{visual?.whyBody || content.description}</p></div>
      <div className="benefits-editorial"><div className="benefits-photo"><img src={visual?.image || p.campaign || p.image} alt={visual?.imageAlt || p.name} width={1600} height={1000} loading="lazy"/><span>THE IQON EVERYDAY</span></div><div className="benefits-points"><h3>{content.title}</h3><ol>{content.benefits?.map((benefit, i) => <li key={benefit.title}><span>{String(i + 1).padStart(2, "0")}</span><div><h4>{benefit.title}</h4><p>{benefit.body}</p></div></li>)}</ol></div></div>
    </section>
    {visual && <section id="formula-story" className="pdp-pathway pdp-section" aria-labelledby="pathway-heading"><div className="pdp-section-heading"><div><p className="eyebrow">{research ? "UNDERSTAND THE SCIENCE" : "THE FORMULA STORY"}</p><h2 id="pathway-heading">{visual.mechanismTitle}</h2></div><a className="pdp-text-link" href="#product-formula">Meet the ingredients <ArrowRight size={17}/></a></div><ol className="pathway-steps">{visual.mechanism.map((step, i) => <li key={step.title}><div className="pathway-number"><span>{String(i + 1).padStart(2, "0")}</span>{i < visual.mechanism.length - 1 && <ArrowRight size={22} aria-hidden="true"/>}</div><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>{research && <a className="pdp-text-link" href="#ingredient-science">Read the ingredient research <ArrowUpRight size={17}/></a>}</section>}
    <section id="product-formula" className="pdp-formula pdp-section" aria-labelledby="formula-heading">
      <div className="pdp-section-heading"><div><p className="eyebrow">THE INGREDIENTS</p><h2 id="formula-heading">Inside the formula.</h2></div>
        <p>{skin ? "Get to know the ingredients and the part each one plays in your skincare routine." : "The ingredients, their forms, and the details that help you choose."}</p>
      </div>
      <ProductFormulaExplorer key={p.id} product={p}/>
      <Accordion type="single" collapsible className="pdp-formula-accordion">
        <AccordionItem value="complete-formula"><AccordionTrigger>{supplement ? "View full ingredient statement & listed amounts" : "View ingredients & formulation"}</AccordionTrigger>
          <AccordionContent>{supplement ? <SupplementFormula details={supplement} /> : skin && <><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{content.formulaNote}</p></>}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
    {content.routine && <section id="product-routine" className="pdp-routine pdp-routine-v3 pdp-section" aria-labelledby="routine-heading">
      <div className="pdp-routine-heading"><p className="eyebrow">HOW TO USE</p><h2 id="routine-heading">{visual?.ritualTitle || content.routine.title}</h2><p className="routine-intro">{content.guide?.details[0]?.body}</p>
        <dl className="pdp-fit">{content.fit?.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
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
    {content.guide && <section id="product-fit" className="pdp-expectations pdp-section" aria-labelledby="expectations-heading"><div><p className="eyebrow">MAKE IT WORK FOR YOU</p><h2 id="expectations-heading">What to expect.<br/>What to keep in mind.</h2></div><div className="expectations-grid">{content.guide.details.slice(1).map(detail => <article key={detail.title}><h3>{detail.title}</h3><p>{detail.body}</p></article>)}</div></section>}
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
        <Link className="pdp-comparison-image" href={`/products/${q.id}`} aria-label={`View ${q.name}`}><img src={q.image} alt={q.name} loading="lazy" width={1122} height={1402} />{p.id === q.id && <span>YOU’RE VIEWING</span>}</Link>
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
