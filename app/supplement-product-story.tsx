import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Pill, Clock3, Droplets, Dumbbell, FlaskConical, Layers2, Leaf, Ruler, Sparkles, Waves } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type Product, productPrice } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { supplementDetails, supplementDisclaimer } from "@/lib/supplement-details";
import { supplementVisualContent } from "@/lib/supplement-visual-content";
import { SupplementIngredientExplorer } from "./supplement-ingredient-explorer";
import { SupplementDirections, SupplementFormula } from "./supplement-information";

const icons={strength:Dumbbell,powder:Waves,drop:Droplets,leaf:Leaf,layers:Layers2,capsule:Pill,clock:Clock3,measure:Ruler,spark:Sparkles,flask:FlaskConical};

export function SupplementProductStory({product:p,comparison}:{product:Product;comparison:Product[]}) {
  const visual=supplementVisualContent[p.id];
  const copy=productContent[p.id];
  const details=supplementDetails[p.id];
  if(!visual||!copy||!details) return null;
  const research=copy.education;
  return <div className="product-experience supplement-pdp-story skin-visual-story">
    <nav className="pdp-section-nav" aria-label="Product information"><a href="#product-benefits">The benefits</a><a href="#product-formula">Inside the formula</a><a href="#product-routine">Your routine</a>{research&&<a href="#ingredient-science">The research</a>}<a href="#compare">Find your fit</a><a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a></nav>

    <section id="product-benefits" className="skin-story-section skin-story-benefits" aria-labelledby="benefits-heading">
      <div className="skin-benefits-editorial">
        <div className="skin-benefits-copy"><p className="skin-kicker">{visual.eyebrow}</p><h2 id="benefits-heading">{visual.title}</h2><p className="skin-benefits-intro">{visual.introduction}</p>
          <div className="skin-benefit-points">{visual.benefits.map(benefit=>{const Icon=icons[benefit.icon];return <article key={benefit.title}><Icon size={27} strokeWidth={1.2} aria-hidden="true"/><h3>{benefit.title}</h3><p>{benefit.body}</p></article>;})}</div>
        </div>
        <figure className="skin-benefits-photo"><img src={`/images/supplement-materials-v1/${p.id}.webp`} alt={visual.imageAlt} width={1122} height={1402} loading="lazy" decoding="async"/><span className="skin-photo-label">{visual.photoLabel}</span><figcaption>{visual.photoCaption}</figcaption></figure>
      </div>
    </section>

    <section id="product-formula" className="skin-story-section skin-story-formula" aria-labelledby="formula-heading">
      <header className="skin-section-title"><p className="skin-kicker">INSIDE THE FORMULA</p><h2 id="formula-heading">{visual.formulaTitle}</h2></header>
      <SupplementIngredientExplorer key={p.id} ingredients={copy.ingredients!} visuals={visual.ingredients} facts={visual.facts}/>
      {visual.composition?<div className="supp-composition" aria-label="Formula composition"><div><p className="skin-kicker">READING THE FORMULA</p><h3>{visual.composition.total}</h3><p>{visual.composition.note}</p></div><div className="supp-composition-measure"><div><strong>{visual.composition.percent}%</strong><span>{visual.composition.label}</span></div><div className="supp-composition-track" aria-hidden="true"><span style={{width:`${visual.composition.percent}%`}}/></div><p>Proportion within the total</p></div></div>:copy.ingredients!.length>1&&<dl className="supp-fact-strip">{visual.facts.map(fact=><div key={fact.label}><dt>{fact.label}</dt><dd><strong>{fact.value}</strong><span>{fact.detail}</span></dd></div>)}</dl>}
      <Accordion type="single" collapsible className="skin-formulation-accordion"><AccordionItem value="formula"><AccordionTrigger>Ingredients, listed amounts & allergen details</AccordionTrigger><AccordionContent><SupplementFormula details={details}/></AccordionContent></AccordionItem></Accordion>
    </section>

    <section id="product-routine" className="skin-story-section skin-story-routine" aria-labelledby="routine-heading">
      <header className="skin-application-heading"><div><p className="skin-kicker">YOUR DAILY ROUTINE</p><h2 id="routine-heading">{visual.routineTitle}</h2></div><span className="skin-timing-label"><Clock3 size={18} strokeWidth={1.2} aria-hidden="true"/>{visual.timing}</span></header>
      <div className="skin-application-board">
        <figure className="skin-application-photo"><img src={p.image} alt={`${p.name} — IQON packaging`} width={320} height={400} loading="lazy" decoding="async"/><figcaption><strong>{p.name}</strong><span>{details.contents}</span></figcaption></figure>
        <ol className="skin-application-steps">{copy.routine!.steps.map((step,i)=>{const Icon=icons[visual.stepIcons[i]];return <li key={step.title}><div className="skin-step-top"><span>0{i+1}</span><Icon size={38} strokeWidth={1} aria-hidden="true"/></div><h3>{step.title}</h3><p>{step.body}</p></li>;})}</ol>
      </div>
      <div className="skin-application-details"><p><strong>Keep in mind</strong>{visual.routineNote}</p><Accordion type="single" collapsible><AccordionItem value="directions"><AccordionTrigger>Read the complete directions & care</AccordionTrigger><AccordionContent><SupplementDirections details={details}/></AccordionContent></AccordionItem></Accordion></div>
    </section>

    {research&&<section id="ingredient-science" className="skin-story-section supp-research" aria-labelledby="research-heading"><div className="supp-research-heading"><BookOpen size={31} strokeWidth={1.1} aria-hidden="true"/><p className="skin-kicker">{research.eyebrow}</p><h2 id="research-heading">{research.title}</h2></div><div className="supp-research-copy"><p>{research.body}</p><div className="supp-research-links">{research.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.label}</span><ArrowUpRight size={17} aria-hidden="true"/></a>)}</div><p className="supp-research-scope">{research.scope}</p></div></section>}

    <section id="compare" className="skin-story-section skin-story-compare" aria-labelledby="comparison-heading">
      <div className="skin-routine-heading"><div><p className="skin-kicker">THE IQON SUPPLEMENT EDIT</p><h2 id="comparison-heading">Find the formula<br/>that fits your routine.</h2></div><div><p>Compare the focus, ingredients and daily format. A clearer choice starts with the details.</p><Link href="/collections/supplements" className="skin-story-link">Explore the collection <ArrowUpRight size={17}/></Link></div></div>
      <p className="skin-compare-scroll-hint">Swipe to compare <ArrowRight size={14} aria-hidden="true"/></p>
      <div className="skin-compare-scroll" role="region" aria-label="Compare supplement formulas" tabIndex={0}>
        <table className="skin-compare-table"><caption className="sr-only">Compare {comparison.map(q=>q.name).join(", ")}</caption>
          <thead><tr><th scope="col"><span>AT A GLANCE</span></th>{comparison.map(q=><th key={q.id} scope="col" className={q.id===p.id?"skin-current":""}><Link href={q.id===p.id?"#overview":`/products/${q.id}`} className="skin-compare-product"><div className="skin-compare-image">{q.id===p.id&&<span className="skin-viewing">YOU’RE VIEWING</span>}<img src={q.image} alt={q.name} width={320} height={400} loading="lazy" decoding="async"/></div><h3>{q.name}</h3><p>{productPrice(q)}<span>{supplementDetails[q.id]?.contents}</span></p></Link></th>)}</tr></thead>
          <tbody>{[
            {label:"Focus",value:(q:Product)=>productContent[q.id]?.comparison?.focus||q.descriptor},
            {label:"Routine",value:(q:Product)=>productContent[q.id]?.comparison?.routine},
            {label:"Formula",value:(q:Product)=>productContent[q.id]?.comparison?.difference}
          ].map(row=><tr key={row.label}><th scope="row">{row.label}</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?"skin-current":""}>{row.value(q)}</td>)}</tr>)}
          <tr className="skin-compare-actions"><th scope="row"><span className="sr-only">Explore</span></th>{comparison.map(q=><td key={q.id} className={q.id===p.id?"skin-current":""}><Link href={q.id===p.id?"#overview":`/products/${q.id}`}>{q.id===p.id?"Back to product":"Explore formula"}<ArrowUpRight size={15}/></Link></td>)}</tr></tbody>
        </table>
      </div>
      <p className="skin-comparison-note">These formulas are shown to help you compare. They are not a recommendation to take them together; choose according to your needs and healthcare professional’s advice.</p>
    </section>

    <section id="product-questions" className="skin-story-section skin-story-faq" aria-labelledby="questions-heading"><div className="skin-faq-heading"><div><p className="skin-kicker">A LITTLE MORE CLARITY</p><h2 id="questions-heading">Your questions,<br/>answered.</h2></div><Link href="/help" className="skin-story-link">Ask IQON <ArrowUpRight size={17}/></Link></div><Accordion type="single" collapsible>{copy.expectations&&<AccordionItem value="expectations"><AccordionTrigger>{copy.expectations.title}</AccordionTrigger><AccordionContent>{copy.expectations.body}</AccordionContent></AccordionItem>}{copy.faqs.map((faq,i)=><AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger>{faq.question}</AccordionTrigger><AccordionContent>{faq.answer}</AccordionContent></AccordionItem>)}</Accordion></section>
    <p className="pdp-disclaimer">*{supplementDisclaimer}</p>
  </div>;
}
