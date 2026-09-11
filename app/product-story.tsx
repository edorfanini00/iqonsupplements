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
 const content=productContent[p.id];if(!content)return null;
 const comparison=comparisonFor(p,products);
 return <>
  <nav className="pdp-section-nav" aria-label="Product information"><a href="#overview">Overview</a><a href="#product-details">Details & research</a><a href="#compare">Explore the collection</a><a href="#reviews">Reviews</a></nav>
  <section id="product-details" className="product-knowledge section-pad"><div className="knowledge-copy"><p className="eyebrow">A CLOSER LOOK</p><h2>{content.title}</h2><div className="knowledge-facts">{content.facts.map(f=><div key={f.label}><small>{f.label}</small><strong>{f.value}</strong></div>)}</div><Accordion type="single" collapsible className="knowledge-accordion"><AccordionItem value="about"><AccordionTrigger>About {p.name}</AccordionTrigger><AccordionContent><p>{content.story}</p></AccordionContent></AccordionItem>{content.education&&<AccordionItem value="research" id="ingredient-science"><AccordionTrigger>Ingredient research</AccordionTrigger><AccordionContent><p>{content.education.body}</p><p className="evidence-context">{content.education.scope}</p><div className="ingredient-sources">{content.education.sources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRight size={14}/></a>)}</div></AccordionContent></AccordionItem>}{content.faqs.map((f,i)=><AccordionItem key={f.question} value={`faq-${i}`}><AccordionTrigger>{f.question}</AccordionTrigger><AccordionContent>{f.answer}</AccordionContent></AccordionItem>)}</Accordion></div></section>
  {comparison.length>1&&<section id="compare" className="visual-comparison section-pad"><div className="section-heading"><h2>{p.category==='skincare'?'Complete the routine.':'A closer look, side by side.'}</h2><Link className="button button-outline" href={`/collections/${p.category}`}>View all {p.category}<ArrowUpRight size={17}/></Link></div><div className="comparison-cards">{comparison.map(q=><Link className={`comparison-card ${p.id===q.id?'is-current':''}`} href={`/products/${q.id}`} key={q.id}><div><img src={q.image} alt={q.name} loading="lazy" width={1122} height={1402}/>{p.id===q.id&&<span>YOU’RE VIEWING</span>}</div><h3>{q.name}</h3><p>{q.category==='skincare'?q.ritual:q.type}<span>{q.size}</span></p><strong>{p.id===q.id?'Current product':'View product'}<ArrowUpRight size={17}/></strong></Link>)}</div></section>}
 </>;
}
