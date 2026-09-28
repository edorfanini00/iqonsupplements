import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { type Product, productPrice } from "@/lib/catalog";
import { productContent } from "@/lib/product-content";
import { skincareStories } from "@/lib/skincare-stories";
import skincareRange from "@/lib/skincare-range.json";
import { skincareVisualContent } from "@/lib/skincare-visual-content";
import { SkincareIngredientExplorer } from "./skincare-ingredient-explorer";
import { SkincareVisualBenefits, SkincareVisualRoutine } from "./skincare-visual-sections";

export function SkincareProductStory({product:p,comparison}:{product:Product;comparison:Product[]}) {
  const story=skincareStories[p.id];
  const copy=productContent[p.id];
  const skin=skincareRange.find(s=>s.id===p.id);
  const visual=skincareVisualContent[p.id];
  if(!story||!copy||!skin||!visual) return null;
  return <div className="product-experience skincare-pdp-story skin-visual-story">
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#product-benefits">The benefits</a><a href="#product-formula">Inside the formula</a><a href="#product-routine">Your routine</a><a href="#compare">Find your fit</a><a href="#product-questions">FAQs</a><a href="#reviews">Reviews</a>
    </nav>

    <section id="product-benefits" className="skin-story-section skin-story-benefits" aria-labelledby="benefits-heading">
      <SkincareVisualBenefits id={p.id} story={story} visual={visual}/>
    </section>

    <section id="product-formula" className="skin-story-section skin-story-formula" aria-labelledby="formula-heading">
      <header className="skin-section-title"><p className="skin-kicker">INSIDE THE FORMULA</p><h2 id="formula-heading">{story.formulaTitle}</h2></header>
      <SkincareIngredientExplorer ingredients={copy.ingredients||[]} visuals={visual.ingredients}/>
      <Accordion type="single" collapsible className="skin-formulation-accordion"><AccordionItem value="formula"><AccordionTrigger>Ingredients & formulation details</AccordionTrigger><AccordionContent><p><strong>Key ingredients:</strong> {skin.ingredients}.</p><p>{copy.formulaNote}</p></AccordionContent></AccordionItem></Accordion>
    </section>

    <section id="product-routine" className="skin-story-section skin-story-routine" aria-labelledby="routine-heading">
      <SkincareVisualRoutine id={p.id} name={p.name} size={skin.size} directions={skin.directions} story={story} visual={visual}/>
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
