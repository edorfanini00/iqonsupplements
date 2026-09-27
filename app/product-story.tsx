import Link from "next/link";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { productPrice, type Product } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { supplementDetails, supplementDisclaimer } from "@/lib/supplement-details";
import skincareRange from "@/lib/skincare-range.json";
import { SupplementFormula, SupplementDirections } from "./supplement-information";

export function comparisonFor(product: Product, products: Product[]) {
  const choices = product.category === "skincare"
    ? ["anti-aging-cleanser-with-peptides", "hydra-c-ferulic-serum", "copper-peptide-restore-cream", "hydrating-tonic"]
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
  return <div className="product-experience">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">Benefits</a><a href="#product-formula">Ingredients</a>
      <a href="#product-routine">How to use</a>{research && <a href="#ingredient-science">Research</a>}
      <a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>
    <section id="product-benefits" className="pdp-benefits pdp-section" aria-labelledby="benefits-heading">
      <div className="pdp-story-image">
        <img src={p.campaign || p.image} alt={`IQON ${p.name}`} width={1122} height={1402} loading="lazy" />
        <span>IQON / {p.category.toUpperCase()}</span>
      </div>
      <div className="pdp-story-copy">
        <p className="eyebrow">{skin ? "CARE WITH A PURPOSE" : "YOUR EVERYDAY, CONSIDERED"}</p>
        <h2 id="benefits-heading">{content.title}</h2>
        <p className="pdp-intro">{content.description}</p>
        <ol className="pdp-benefit-list">{content.benefits?.map((benefit, i) => <li key={benefit.title}>
          <span className="pdp-step-number">{String(i + 1).padStart(2, "0")}</span>
          <div><h3>{benefit.title}</h3><p>{benefit.body}</p></div>
        </li>)}</ol>
        <a className="pdp-text-link" href="#product-formula">Explore the formula <ArrowRight size={17} /></a>
      </div>
    </section>
    <dl className="pdp-fact-strip" aria-label="Product at a glance">
      {content.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}{fact.detail && <p>{fact.detail}</p>}</dd></div>)}
    </dl>
    <section id="product-formula" className="pdp-formula pdp-section" aria-labelledby="formula-heading">
      <div className="pdp-section-heading"><div><p className="eyebrow">THE INGREDIENTS</p><h2 id="formula-heading">Inside the formula.</h2></div>
        <p>{skin ? "Get to know the ingredients and the part each one plays in your skincare routine." : "The ingredients, their forms, and the details that help you choose."}</p>
      </div>
      <div className="pdp-ingredient-list">{content.ingredients?.map((ingredient, i) => <article key={ingredient.name}>
        <span className="pdp-ingredient-index">{String(i + 1).padStart(2, "0")}</span>
        <div><p className="eyebrow">{ingredient.role}</p><h3>{ingredient.name}</h3></div>
        <p>{ingredient.detail}</p>{ingredient.amount && <span className="pdp-ingredient-amount">{ingredient.amount}</span>}
      </article>)}</div>
      <Accordion type="single" collapsible className="pdp-formula-accordion">
        <AccordionItem value="complete-formula"><AccordionTrigger>{supplement ? "View full ingredient statement & listed amounts" : "View ingredients & formulation"}</AccordionTrigger>
          <AccordionContent>{supplement ? <SupplementFormula details={supplement} /> : skin && <><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{content.formulaNote}</p></>}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
    {content.routine && <section id="product-routine" className="pdp-routine pdp-section" aria-labelledby="routine-heading">
      <div className="pdp-routine-heading"><p className="eyebrow">HOW TO USE</p><h2 id="routine-heading">{content.routine.title}</h2>
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
      <div className="pdp-section-heading"><div><p className="eyebrow">{skin ? "BUILD YOUR ROUTINE" : "FIND YOUR FIT"}</p><h2 id="comparison-heading">{skin ? "A place for every step." : "A closer look, side by side."}</h2></div>
        <Link className="pdp-text-link" href={`/collections/${p.category}`}>Explore {p.category}<ArrowUpRight size={17} /></Link>
      </div>
      <div className="pdp-comparison-grid">{comparison.map(q => <article className={p.id === q.id ? "is-current" : ""} key={q.id}>
        <Link className="pdp-comparison-image" href={`/products/${q.id}`} aria-label={`View ${q.name}`}><img src={q.image} alt={q.name} loading="lazy" width={1122} height={1402} />{p.id === q.id && <span>YOU’RE VIEWING</span>}</Link>
        <h3><Link href={`/products/${q.id}`}>{q.name}</Link></h3><p>{productContent[q.id]?.descriptor || q.descriptor}</p>
        <dl><div><dt>{skin ? "Step" : "Format"}</dt><dd>{skin ? q.ritual : q.type}</dd></div>{q.size && <div><dt>Size</dt><dd>{q.size}</dd></div>}<div><dt>Price</dt><dd>{productPrice(q)}</dd></div></dl>
        <Link className="pdp-comparison-link" href={`/products/${q.id}`}>{p.id === q.id ? "Back to product" : "Explore product"}{p.id === q.id ? <ArrowUpRight size={17} /> : <Plus size={17} />}</Link>
      </article>)}</div>
    </section>}
    {supplement && <p className="pdp-disclaimer">*{supplementDisclaimer}</p>}
  </div>;
}
