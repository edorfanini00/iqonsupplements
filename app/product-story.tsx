import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { Product } from '@/lib/catalog';
import { productContent } from '@/lib/product-content';

export function comparisonFor(product:Product, products:Product[]) {
  const preferred = product.category==='skincare'
    ? ['gentle-cleanser','peptide-serum','barrier-cream']
    : ['nmn','resveratrol'].includes(product.id)
      ? [product.id,product.id==='nmn'?'resveratrol':'nmn']
      : ['hydrolyzed-collagen-peptides','collagen-peptides-chocolate'].includes(product.id)
        ? [product.id,product.id==='hydrolyzed-collagen-peptides'?'collagen-peptides-chocolate':'hydrolyzed-collagen-peptides']
      : product.type==='Powder'
        ? [product.id,...['creatine-monohydrate','hydrolyzed-collagen-peptides','collagen-peptides-chocolate','colostrum-powder'].filter(id=>id!==product.id)]
        : product.type==='Capsules'
          ? [product.id,...['keto-5','glp-1-support','liver-support'].filter(id=>id!==product.id)]
          : [product.id,'hydrolyzed-collagen-peptides','resveratrol'];
  return preferred.map(id=>products.find(p=>p.id===id)).filter((p):p is Product=>!!p).slice(0,3);
}

export function ProductStory({product:p,products}:{product:Product;products:Product[]}) {
  const content=productContent[p.id];
  if(!content) return null;
  const comparison=comparisonFor(p,products);
  const photo=p.images?.[1] || {src:p.campaign,alt:`IQON ${p.category} collection`};
  const landscape=photo.src.endsWith('-detail.webp')||/\/(19_|2[0-5]_)/.test(photo.src)||p.category==='skincare';
  const skincare=p.category==='skincare';
  return <>
    <nav className="pdp-section-nav" aria-label="Product information">
      <a href="#overview">Overview</a><a href="#product-details">Product details</a>{content.education&&<a href="#ingredient-science">Ingredient science</a>}<a href="#compare">{skincare?'The routine':'Compare products'}</a><a href="#reviews">Reviews</a><a href="#product-questions">Questions</a>
    </nav>
    <section className="pdp-story section-pad" aria-labelledby="product-story-title">
      <div className={`pdp-story-photo ${landscape?'landscape':''}`}><img src={photo.src} alt={photo.alt} loading="lazy" width={1200} height={1400}/></div>
      <div className="pdp-story-copy"><p className="eyebrow">{skincare?'THE IQON SKINCARE COLLECTION':'A CLOSER LOOK'}</p><h2 id="product-story-title">{content.title}</h2><p>{content.story}</p><a className="under-link" href="#product-details">See the details <ArrowUpRight size={16}/></a></div>
    </section>
    <section id="product-details" className="pdp-facts section-pad" aria-labelledby="product-details-title">
      <div className="pdp-section-heading"><div><p className="eyebrow">AT A GLANCE</p><h2 id="product-details-title">The product details.</h2></div><p>{skincare?'The format and proposed routine step for this skincare concept.':'The name, format and amount in the pack, in one place.'}</p></div>
      <div className="pdp-facts-grid">{content.facts.map(f=><div className="pdp-fact" key={f.label}><span>{f.label}</span><strong>{f.value}</strong><p>{f.detail}</p></div>)}</div>
    </section>
    {content.education&&<section className="ingredient-education section-pad" id="ingredient-science" aria-labelledby="ingredient-science-title"><div><p className="eyebrow">{content.education.eyebrow}</p><h2 id="ingredient-science-title">{content.education.title}</h2></div><div><p>{content.education.body}</p><p className="evidence-context">{content.education.scope}</p><div className="ingredient-sources">{content.education.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRight size={14}/></a>)}</div></div></section>}
    {comparison.length>1&&<section id="compare" className="pdp-comparison section-pad" aria-labelledby="compare-title">
      <div className="pdp-section-heading"><div><p className="eyebrow">{skincare?'CLEANSE · TREAT · MOISTURIZE':'FIND YOUR FORMAT'}</p><h2 id="compare-title">{skincare?'Three steps, side by side.':'See how they compare.'}</h2></div><p>{skincare?'Explore the place of each product in our upcoming skincare routine.':'Different products, clearly identified. Compare the format and pack size before you choose.'}</p></div>
      <div className="pdp-table-wrap" role="region" aria-label="Product comparison table" tabIndex={0}><table className="pdp-compare-table"><caption>{skincare?'IQON skincare routine':'IQON product formats and pack sizes'}</caption><thead><tr><th scope="col">{skincare?'Your routine':'The collection'}</th>{comparison.map(q=><th key={q.id} scope="col" className={q.id===p.id?'current':''}><small>{q.id===p.id?'You’re viewing':'Explore IQON'}</small><Link href={`/products/${q.id}`}><img src={q.image} alt={q.name} width={250} height={300} loading="lazy"/>{q.name}</Link></th>)}</tr></thead><tbody>
      <tr><th scope="row">Format</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?'current':''}>{q.type}</td>)}</tr>
      <tr><th scope="row">Pack size</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?'current':''}>{q.size}</td>)}</tr>
      {skincare&&<tr><th scope="row">Step</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?'current':''}>{q.ritual}</td>)}</tr>}
      <tr><th scope="row">Discover</th>{comparison.map(q=><td key={q.id} className={q.id===p.id?'current':''}>{q.id===p.id?'Current product':<Link href={`/products/${q.id}`}>View product <span aria-hidden="true">↗</span></Link>}</td>)}</tr>
      </tbody></table></div>
    </section>}
    <section id="product-questions" className="pdp-faq section-pad" aria-labelledby="product-questions-title"><div className="faq-intro"><p className="eyebrow">GOOD TO KNOW</p><h2 id="product-questions-title">Your questions,<br/>answered.</h2><p>Looking for something else?<br/><Link className="under-link" href="/help">Visit questions & care <ArrowUpRight size={15}/></Link></p></div><Accordion type="single" collapsible>{content.faqs.map((f,i)=><AccordionItem key={f.question} value={`question-${i}`}><AccordionTrigger>{f.question}</AccordionTrigger><AccordionContent>{f.answer}</AccordionContent></AccordionItem>)}</Accordion></section>
  </>;
}
