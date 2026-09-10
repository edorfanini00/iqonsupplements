"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronsLeftRight, Star } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Product } from "@/lib/catalog";
import type { CustomerReview } from "@/lib/reviews";
import type { SkinResult } from "@/lib/skincare-results";

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

export function SkinResults({results, products}:{results:SkinResult[];products:Product[]}) {
  const [selected,setSelected]=useState(0);
  const [reveal,setReveal]=useState(50);
  const headingId=useId();
  const helpId=useId();
  const result=results[selected]||results[0];
  if(!result)return null;
  const product=products.find(p=>p.id===result.productId);
  return <section className="skin-results section-pad" aria-labelledby={headingId}>
    <div className="skin-results-gallery">
      <div className="skin-comparison">
        <img src={result.after.src} alt={result.after.alt} width={1200} height={1200} loading="lazy"/>
        <img className="skin-comparison-before" src={result.before.src} alt={result.before.alt} width={1200} height={1200} loading="lazy" style={{clipPath:`inset(0 ${100-reveal}% 0 0)`}}/>
        <span className="skin-comparison-label label-before">Before</span><span className="skin-comparison-label label-after">After</span>
        <span className="skin-comparison-divider" style={{left:`${reveal}%`}} aria-hidden="true"><span><ChevronsLeftRight size={22}/></span></span>
        <Slider className="skin-comparison-control" value={[reveal]} min={0} max={100} step={1} onValueChange={value=>setReveal(value[0])} role="group" aria-label="Before and after photo comparison" aria-describedby={helpId}/>
        {product&&<Link className="skin-result-product" href={`/products/${product.id}`}><img src={product.image} alt="" width={44} height={56}/><span>Results from<strong>{product.name}</strong></span><ArrowRight size={18}/></Link>}
      </div>
      {results.length>1&&<div className="skin-result-thumbnails" role="group" aria-label="Choose a skin result">{results.map((item,index)=><button key={item.id} aria-label={item.label} aria-pressed={index===selected} onClick={()=>{setSelected(index);setReveal(50);}}><img src={item.after.src} alt="" width={80} height={80} loading="lazy"/><span aria-hidden="true"/></button>)}</div>}
      <p className="skin-comparison-help" id={helpId}>Drag to compare. You can also use the arrow keys.</p>
    </div>
    <div className="skin-results-copy">
      <p className="eyebrow">PRODUCT RESULTS</p><h2 id={headingId}>{result.headline}</h2><p className="skin-result-timeframe">{result.timeframe}</p>
      {result.metrics.length>0&&<div className="skin-result-metrics">{result.metrics.map(metric=><div key={metric.description}><strong>{metric.value}</strong><p>{metric.description}</p></div>)}</div>}
      <p className="skin-result-methodology">{result.methodology}</p><a className="under-link" href={result.source.url} target="_blank" rel="noopener noreferrer">{result.source.label}<ArrowUpRight size={14}/></a>
    </div>
  </section>;
}

function ReviewStars({rating}:{rating:number}) {
  return <span className="skin-review-stars" aria-label={`${rating} out of 5 stars`}>{[1,2,3,4,5].map(n=><Star key={n} size={14} fill={n<=rating?"currentColor":"none"}/>)}</span>;
}

export function SkincareReviews({reviews,products}:{reviews:CustomerReview[];products:Product[]}) {
  const rail=useRef<HTMLDivElement>(null);
  const headingId=useId();
  const average=reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:0;
  const move=(direction:number)=>{const e=rail.current;if(e)e.scrollBy({left:direction*e.clientWidth*.8,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <section className={`skin-community ${reviews.length?'has-reviews':'awaiting-reviews'}`} id="skincare-reviews" aria-labelledby={headingId}>
    <div className="skin-community-heading">{reviews.length>0&&<ReviewStars rating={Number(average.toFixed(1))}/>}<h2 id={headingId}>{reviews.length?'Customer reviews':'Your skin. Your story.'}</h2>{reviews.length>0&&<span>{average.toFixed(1)} / 5 · {reviews.length} {reviews.length===1?'review':'reviews'}</span>}</div>
    {reviews.length>0?<>
      <div className="skin-review-rail" ref={rail} tabIndex={0} role="region" aria-label="Skincare customer reviews">
        {reviews.map(review=>{
          const product=products.find(p=>p.id===review.productId);
          return <article className={`skin-review-card ${review.media?'skin-review-with-media':''}`} key={review.id}>
            {review.media?<div className="skin-review-media">{review.media.type==='video'?<video controls playsInline preload="none" poster={review.media.poster} aria-label={review.media.alt}><source src={review.media.src}/>{review.media.alt}</video>:<img src={review.media.src} alt={review.media.alt} width={600} height={800} loading="lazy"/>}</div>:<div className="skin-review-quote"><ReviewStars rating={review.rating}/><blockquote>{review.title}</blockquote><p>{review.text}</p></div>}
            <footer><strong>{review.author}</strong>{review.verifiedPurchase&&<span>Verified purchase</span>}{product&&<Link href={`/products/${product.id}`}>{product.name}<ArrowUpRight size={12}/></Link>}</footer>
          </article>;
        })}
      </div>
      <div className="skin-review-controls"><button onClick={()=>move(-1)} aria-label="Previous skincare reviews"><ArrowLeft size={18}/></button><Link className="button button-outline" href="/reviews?collection=skincare">Read all reviews<ArrowUpRight size={15}/></Link><button onClick={()=>move(1)} aria-label="More skincare reviews"><ArrowRight size={18}/></button></div>
    </>:<div className="skin-community-intro" tabIndex={0} role="region" aria-label="IQON skincare brand stories">
      <figure><img src="/images/editorial/skincare-hands-v7.webp" alt="IQON brand photography of Peptide Serum as part of a daily skincare ritual" width={1792} height={2400} loading="lazy"/><figcaption>The daily ritual</figcaption></figure>
      <div className="skin-community-note"><p className="eyebrow">CUSTOMER REVIEWS</p><h3>Every skin.<br/>A story to tell.</h3><p>Customer reviews will appear here after launch.</p><Link className="under-link" href="/reviews?collection=skincare">Visit customer reviews<ArrowUpRight size={15}/></Link></div>
      <figure><img src="/images/editorial/skincare-campaign-mobile.webp" alt="IQON brand photography of Peptide Serum and Barrier Cream" width={1792} height={2400} loading="lazy"/><figcaption>The everyday essentials</figcaption></figure>
    </div>}
  </section>;
}
