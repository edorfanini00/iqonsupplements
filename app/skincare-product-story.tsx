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
  return <div className="product-experience skin-story">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">The benefits</a><a href="#product-formula">Inside the formula</a><a href="#product-routine">Your routine</a><a href="#compare">Find your fit</a><a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>

    <section id="product-benefits" className="skin-story-section skin-story-benefits" aria-labelledby="benefits-heading">
      <figure className="skin-story-portrait">
        <img src={`${asset}-use.webp`} alt={story.imageAlt} width={1122} height={1402} loading="lazy" decoding="async"/>
        <figcaption>{story.photoCaption}</figcaption>
      </figure>
      <div className="skin-benefit-content">
        <p className="skin-kicker">{story.eyebrow}</p>
        <h2 id="benefits-heading">{story.title}</h2>
        <p className="skin-introduction">{story.introduction}</p>
        <div className="skin-benefit-points">{story.benefits.map((benefit,i)=><article key={benefit.title}>
          <span aria-hidden="true">0{i+1}</span><div><h3>{benefit.title}</h3><p>{benefit.body}</p></div>
        </article>)}</div>
      </div>
      <dl className="skin-facts" aria-label="Formula and routine details">{story.facts.map(f=><div key={f.label}><dt>{f.label}</dt><dd><strong>{f.value}</strong><span>{f.detail}</span></dd></div>)}</dl>
    </section>

    <section id="product-formula" className="skin-story-section skin-story-formula" aria-labelledby="formula-heading">
      <div className="skin-section-title"><p className="skin-kicker">INSIDE THE FORMULA</p><h2 id="formula-heading">{story.formulaTitle}</h2><p>{story.formulaIntro}</p></div>
      <div className="skin-formula-layout">
        <figure className="skin-formula-photo"><img src={`${asset}.webp`} alt={`${p.name} — IQON formula editorial`} width={1122} height={1402} loading="lazy" decoding="async"/><figcaption><span>IQON / SKINCARE</span><span>{skin.size}</span></figcaption></figure>
        <div className="skin-formula-copy">
          <p className="skin-kicker">KEY INGREDIENTS & THEIR ROLES</p>
          <div className="skin-ingredient-list">{copy.ingredients?.map((item,i)=><article key={item.name}>
            <span className="skin-ingredient-number" aria-hidden="true">0{i+1}</span><div><p className="skin-ingredient-role">{item.role}</p><h3>{item.name}</h3><p>{item.detail}</p></div>
          </article>)}</div>
          <Accordion type="single" collapsible className="skin-formulation-accordion"><AccordionItem value="formula"><AccordionTrigger>Ingredients & formulation details</AccordionTrigger><AccordionContent><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{copy.formulaNote}</p></AccordionContent></AccordionItem></Accordion>
        </div>
      </div>
      <div id="formula-story" className="skin-formula-perspective">
        <div><p className="skin-kicker">{story.perspective.eyebrow}</p><h3>{story.perspective.title}</h3><p>{story.perspective.body}</p></div>
        <div className="skin-perspective-points">{story.perspective.points.map(point=><article key={point.title}><h4>{point.title}</h4><p>{point.body}</p></article>)}</div>
      </div>
    </section>

    <section id="product-routine" className="skin-story-section skin-story-routine" aria-labelledby="routine-heading">
      <div className="skin-routine-heading"><div><p className="skin-kicker">THE APPLICATION</p><h2 id="routine-heading">{copy.routine?.title || "Make it part of your routine."}</h2></div><p>{story.routineIntro}</p></div>
      <ol className="skin-use-steps">{copy.routine?.steps.map((step,i)=><li key={step.title}><span className="skin-step-number">0{i+1}</span><h3>{step.title}</h3><p>{step.body}</p>{i<2&&<ArrowRight size={19} aria-hidden="true"/>}</li>)}</ol>
      <div className="skin-routine-note"><p><strong>Keep in mind</strong>{story.routineNote}</p><Accordion type="single" collapsible><AccordionItem value="directions"><AccordionTrigger>Read the complete directions</AccordionTrigger><AccordionContent>{skin.directions}</AccordionContent></AccordionItem></Accordion></div>
    </section>

    <section id="compare" className="skin-story-section skin-story-compare" aria-labelledby="comparison-heading">
      <div className="skin-routine-heading"><div><p className="skin-kicker">THE IQON SKINCARE EDIT</p><h2 id="comparison-heading">Different formulas.<br/>A considered choice.</h2></div><div><p>See what each step brings to your routine, from its key ingredients to when you use it.</p><Link href="/collections/skincare" className="skin-story-link">Explore the collection <ArrowUpRight size={17}/></Link></div></div>
      <p className="skin-compare-scroll-hint">Swipe to compare <ArrowRight size={14} aria-hidden="true"/></p>
      <div className="skin-compare-scroll" role="region" aria-label="Compare skincare formulas" tabIndex={0}>
        <table className="skin-compare-table"><caption className="sr-only">Compare {comparison.map(q=>q.name).join(", ")}</caption>
          <thead><tr><th scope="col"><span>Your skincare,<br/>step by step.</span></th>{comparison.map(q=><th key={q.id} scope="col" className={q.id===p.id?"skin-current":""}>
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
      <div className="skin-faq-heading"><div><p className="skin-kicker">A LITTLE MORE CLARITY</p><h2 id="questions-heading">Good questions.<br/>Clear answers.</h2></div><Link href="/help" className="skin-story-link">Ask IQON <ArrowUpRight size={17}/></Link></div>
      <Accordion type="single" collapsible>{copy.expectations&&<AccordionItem value="expectations"><AccordionTrigger>{copy.expectations.title}</AccordionTrigger><AccordionContent>{copy.expectations.body}</AccordionContent></AccordionItem>}{copy.faqs.map((faq,i)=><AccordionItem key={faq.question} value={`faq-${i}`}><AccordionTrigger>{faq.question}</AccordionTrigger><AccordionContent>{faq.answer}</AccordionContent></AccordionItem>)}</Accordion>
    </section>
  </div>;
}
