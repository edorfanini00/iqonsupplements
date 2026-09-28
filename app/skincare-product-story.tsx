import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type Product, productPrice } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { skincareStories } from "@/lib/skincare-stories";
import skincareRange from "@/lib/skincare-range.json";

export function SkincareProductStory({product:p,comparison}:{product:Product;comparison:Product[]}) {
  const story=skincareStories[p.id];
  const copy=productContent[p.id];
  const skin=skincareRange.find(s=>s.id===p.id);
  if(!story||!copy||!skin) return null;
  const asset=`/images/pdp-stories-v5/${p.id}`;
  return <div className="product-experience skincare-pdp-story">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">The benefits</a><a href="#product-formula">Inside the formula</a><a href="#product-routine">Your routine</a><a href="#compare">Find your fit</a><a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>

    <section id="product-benefits" className="skin-story-section skin-story-benefits" aria-labelledby="benefits-heading">
      <header className="skin-benefit-heading">
        <p className="skin-kicker">{story.eyebrow}</p>
        <h2 id="benefits-heading">{story.title}</h2>
        <p className="skin-introduction">{story.introduction}</p>
      </header>
      <div className="skin-benefits-feature">
        <div className="skin-at-a-glance">
          <p className="skin-kicker">THE FORMULA AT A GLANCE</p>
          <dl className="skin-feature-facts">{story.facts.map(f=><div key={f.label}>
            <dt>{f.label}</dt><dd><strong>{f.value}</strong><span>{f.detail}</span></dd>
          </div>)}</dl>
        </div>
        <figure className="skin-material-visual">
          <img src={`/images/pdp-materials-v6/${p.id}.webp`} alt={story.imageAlt} width={1122} height={1402} loading="lazy" decoding="async"/>
          <figcaption>{story.photoCaption}</figcaption>
        </figure>
      </div>
      <div className="skin-benefit-grid">{story.benefits.map((benefit,i)=><article key={benefit.title}>
        <span className="skin-small-number" aria-hidden="true">0{i+1}</span><h3>{benefit.title}</h3><p>{benefit.body}</p>
      </article>)}</div>
    </section>

    <section id="product-formula" className="skin-story-section skin-story-formula" aria-labelledby="formula-heading">
      <header className="skin-section-title"><p className="skin-kicker">INSIDE THE FORMULA</p><h2 id="formula-heading">{story.formulaTitle}</h2><p>{story.formulaIntro}</p></header>
      <div className="skin-ingredients-editorial">{copy.ingredients?.map((item,i)=><article className="skin-ingredient-row" key={item.name}>
        <span className="skin-ingredient-index" aria-hidden="true">0{i+1}</span>
        <div className="skin-ingredient-heading"><p className="skin-ingredient-role">{item.role}</p><h3>{item.name}</h3></div>
        <p className="skin-ingredient-description">{item.detail}</p>
      </article>)}</div>
      <Accordion type="single" collapsible className="skin-formulation-accordion"><AccordionItem value="formula"><AccordionTrigger>Ingredients & formulation details</AccordionTrigger><AccordionContent><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{copy.formulaNote}</p></AccordionContent></AccordionItem></Accordion>
      <aside id="formula-story" className="skin-formula-perspective">
        <div><p className="skin-kicker">{story.perspective.eyebrow}</p><h3>{story.perspective.title}</h3></div>
        <div className="skin-perspective-points">{story.perspective.points.map(point=><article key={point.title}><h4>{point.title}</h4><p>{point.body}</p></article>)}</div>
      </aside>
    </section>

    <section id="product-routine" className="skin-story-section skin-story-routine" aria-labelledby="routine-heading">
      <header className="skin-routine-heading"><div><p className="skin-kicker">THE APPLICATION</p><h2 id="routine-heading">{copy.routine?.title || "Make it part of your routine."}</h2></div><p>{story.routineIntro}</p></header>
      <div className="skin-routine-layout">
        <div className="skin-routine-instructions">
          <ol className="skin-use-steps">{copy.routine?.steps.map((step,i)=><li key={step.title}>
            <span className="skin-step-number" aria-hidden="true">0{i+1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div>
          </li>)}</ol>
          <div className="skin-routine-note"><p><strong>Keep in mind</strong>{story.routineNote}</p><Accordion type="single" collapsible><AccordionItem value="directions"><AccordionTrigger>Read the complete directions</AccordionTrigger><AccordionContent>{skin.directions}</AccordionContent></AccordionItem></Accordion></div>
        </div>
        <figure className="skin-routine-product"><img src={`${asset}.webp`} alt={`${p.name} — IQON product editorial`} width={1122} height={1402} loading="lazy" decoding="async"/><figcaption><div><span className="skin-kicker">YOUR ROUTINE / IQON</span><strong>{p.name}</strong></div><span>{skin.size}</span></figcaption></figure>
      </div>
    </section>

    <section id="compare" className="skin-story-section skin-story-compare" aria-labelledby="comparison-heading">
      <div className="skin-routine-heading"><div><p className="skin-kicker">THE IQON SKINCARE EDIT</p><h2 id="comparison-heading">Find your place<br/>in the routine.</h2></div><div><p>See what each step brings to your routine, from its key ingredients to when you use it.</p><Link href="/collections/skincare" className="skin-story-link">Explore the collection <ArrowUpRight size={17}/></Link></div></div>
      <p className="skin-compare-scroll-hint">Swipe to compare <ArrowRight size={14} aria-hidden="true"/></p>
      <div className="skin-compare-scroll" role="region" aria-label="Compare skincare formulas" tabIndex={0}>
        <table className="skin-compare-table"><caption className="sr-only">Compare {comparison.map(q=>q.name).join(", ")}</caption>
          <thead><tr><th scope="col"><span>AT A GLANCE</span></th>{comparison.map(q=><th key={q.id} scope="col" className={q.id===p.id?"skin-current":""}>
            <Link href={q.id===p.id?"#overview":`/products/${q.id}`} className="skin-compare-product"><div className="skin-compare-image">{q.id===p.id&&<span className="skin-viewing">YOU’RE VIEWING</span>}<img src={q.image} alt={q.name} width={320} height={400} loading="lazy" decoding="async"/></div><h3>{q.name}</h3><p>{productPrice(q)}<span>{skincareRange.find(s=>s.id===q.id)?.size}</span></p></Link>
          </th>)}</tr></thead>
          <tbody>{[
            {label:"Focus",value:(q:Product)=>productContent[q.id]?.comparison?.focus||q.descriptor},
            {label:"When",value:(q:Product)=>productContent[q.id]?.comparison?.routine||"Follow product directions"},
            {label:"Formula",value:(q:Product)=>productContent[q.id]?.comparison?.difference||skincareRange.find(s=>s.id===q.id)?.ingredients}
          ].map(row=><tr key={row.label}><th scope="row">{row.label}</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?"skin-current":""}>{row.value(q)}</td>)}</tr>)}
          <tr className="skin-compare-actions"><th scope="row"><span className="sr-only">Explore</span></th>{comparison.map(q=><td key={q.id} className={q.id===p.id?"skin-current":""}><Link href={q.id===p.id?"#overview":`/products/${q.id}`}>{q.id===p.id?"Back to product":"Explore formula"}<ArrowUpRight size={15}/></Link></td>)}</tr></tbody>
        </table>
      </div>
      <p className="skin-comparison-note">Choose steps to suit your skin. These formulas are shown for comparison; they do not all need to be layered together.</p>
    </section>

    <section id="product-questions" className="skin-story-section skin-story-faq" aria-labelledby="questions-heading">
      <div className="skin-faq-heading"><div><p className="skin-kicker">A LITTLE MORE CLARITY</p><h2 id="questions-heading">Your questions,<br/>answered.</h2></div><Link href="/help" className="skin-story-link">Ask IQON <ArrowUpRight size={17}/></Link></div>
      <Accordion type="single" collapsible>{copy.expectations&&<AccordionItem value="expectations"><AccordionTrigger>{copy.expectations.title}</AccordionTrigger><AccordionContent>{copy.expectations.body}</AccordionContent></AccordionItem>}{copy.faqs.map((faq,i)=><AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger>{faq.question}</AccordionTrigger><AccordionContent>{faq.answer}</AccordionContent></AccordionItem>)}</Accordion>
    </section>
  </div>;
}
