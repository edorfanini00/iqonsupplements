"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronsLeftRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Product } from "@/lib/catalog";
import type { SkinResult } from "@/lib/skincare-results";
import { sampleSkinResults } from "@/lib/skincare-design-preview";

export function SkincareDiscovery() {
  return <section className="skin-discovery" aria-label="Discover the IQON skincare collection">
    <div className="skin-ritual-notes">
      <div><span>01</span><h3>Cleanse</h3><p>Begin with the essentials.</p></div>
      <div><span>02</span><h3>Treat</h3><p>Make a little time for you.</p></div>
      <div><span>03</span><h3>Moisturize</h3><p>The finishing touch.</p></div>
    </div>
    <p className="eyebrow skin-discovery-label">THE SKINCARE COLLECTION</p>
    <div className="skin-discovery-grid">
      <Link href="/collections/skincare" className="skin-discovery-card">
        <img src="/images/store/campaign-skincare.webp" alt="The IQON Gentle Cleanser, Peptide Serum and Barrier Cream collection" width={1920} height={1080} loading="lazy"/>
        <div><h2>A few essentials.</h2><span className="under-link">Shop all skincare<ArrowUpRight size={16}/></span></div>
      </Link>
      <Link href="/journal/a-simple-skincare-routine" className="skin-discovery-card">
        <img src="/images/editorial/skincare-touch-v7.webp" alt="A woman gently applying cream to her cheek as part of her skincare ritual" width={3712} height={4608} loading="lazy"/>
        <div><h2>A moment for you.</h2><span className="under-link">Find your skincare rhythm<ArrowUpRight size={16}/></span></div>
      </Link>
    </div>
  </section>;
}

export function SkinResults({results, products,designPreview=false}:{results:SkinResult[];products:Product[];designPreview?:boolean}) {
  const [selected,setSelected]=useState(0);
  const [reveal,setReveal]=useState(50);
  const headingId=useId();
  const helpId=useId();
  const isSample=designPreview&&results.length===0;
  const entries=isSample?sampleSkinResults:results;
  const result=entries[selected]||entries[0];
  if(!result)return null;
  const product=products.find(p=>p.id===result.productId);
  return <section className={`skin-results ${isSample?'skin-results-sample':''}`} id="skincare-results" aria-labelledby={headingId}>
    <div className="skin-results-gallery">
      <div className="skin-comparison">
        <div className="skin-comparison-layer"><img src={result.after.src} alt={result.after.alt} width={1200} height={1200} loading="lazy"/></div>
        <div className="skin-comparison-layer skin-comparison-before" style={{clipPath:`inset(0 ${100-reveal}% 0 0)`}}><img src={result.before.src} alt={result.before.alt} width={1200} height={1200} loading="lazy"/></div>
        <span className="skin-comparison-label label-before">Before</span><span className="skin-comparison-label label-after">After{!isSample&&<span className="skin-comparison-brand">IQON</span>}</span>
        <span className="skin-comparison-divider" style={{left:`${reveal}%`}} aria-hidden="true"><span><ChevronsLeftRight size={22}/></span></span>
        <Slider className="skin-comparison-control" value={[reveal]} min={0} max={100} step={1} onValueChange={value=>setReveal(value[0])} role="group" aria-label="Before and after photo comparison" aria-describedby={helpId}/>
        {product&&<Link className="skin-result-product" href={`/products/${product.id}`}><img src={product.image} alt="" width={44} height={56}/><span>{isSample?'Explore the product':'Results from'}<strong>{product.name}</strong></span><ArrowRight size={18}/></Link>}
      </div>
      {entries.length>1&&<div className="skin-result-thumbnails" role="group" aria-label={isSample?"Choose a skin detail":"Choose a skin result"}>{entries.map((item,index)=><button key={item.id} aria-label={item.label} aria-pressed={index===selected} onClick={()=>{setSelected(index);setReveal(50);}}><img src={item.after.src} alt="" width={80} height={80} loading="lazy"/><img className="skin-thumbnail-before" src={item.before.src} alt="" width={80} height={80} loading="lazy"/><span aria-hidden="true"/></button>)}</div>}
      <p className="sr-only" id={helpId}>Drag to compare. You can also use the arrow keys.</p>
      {isSample&&<p className="skin-comparison-caption">{result.methodology}</p>}
    </div>
    <div className="skin-results-copy">
      <div className="skin-results-summary"><p className="eyebrow">{isSample?'A CLOSER LOOK':'PRODUCT RESULTS'}</p><h2 id={headingId}>{result.headline}</h2><p className="skin-result-timeframe">{result.timeframe}</p></div>
      {result.metrics.length>0&&<div className="skin-results-measurements">{!isSample&&<p className="eyebrow">REPORTED RESULTS</p>}<div className="skin-result-metrics">{result.metrics.map(metric=><div key={metric.description}><strong>{metric.value}</strong><p>{metric.description}</p></div>)}</div></div>}
      {!isSample&&<div className="skin-result-source"><p className="skin-result-methodology">{result.methodology}</p>{result.source.url&&<a className="under-link" href={result.source.url} target="_blank" rel="noopener noreferrer">{result.source.label}<ArrowUpRight size={14}/></a>}</div>}
    </div>
  </section>;
}

export { CommunityReviews as SkincareReviews } from "../community-reviews";
