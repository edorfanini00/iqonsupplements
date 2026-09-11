"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Star } from "lucide-react";
import type { Product, Category } from "@/lib/catalog";
import type { CustomerReview } from "@/lib/reviews";
import { sampleReviewCards } from "@/lib/skincare-design-preview";
import { supplementReviewCards } from "@/lib/review-design-preview";
import "./community-reviews.css";

function ReviewStars({rating,sample=false}:{rating:number;sample?:boolean}) {
  return <span className="skin-review-stars" aria-label={sample?'Sample star treatment, not a customer rating':`${rating} out of 5 stars`}>{[1,2,3,4,5].map(n=><span className="skin-review-star" key={n}><Star size={14}/><span style={{width:`${Math.max(0,Math.min(1,rating-n+1))*100}%`}}><Star size={14} fill="currentColor"/></span></span>)}</span>;
}

export function CommunityReviews({reviews,products,designPreview=false,category="skincare"}:{reviews:CustomerReview[];products:Product[];designPreview?:boolean;category?:Category}) {
  const skin=category==="skincare";
  const cards=skin?sampleReviewCards:supplementReviewCards;
  const reviewHref=`/reviews?collection=${category}`;
  const introImages=skin?[
    {src:"/images/editorial/community-serum-iqon-v11.webp",alt:"Hands holding IQON Peptide Serum as part of a daily skincare ritual"},
    {src:"/images/editorial/community-cream-iqon-v11.webp",alt:"IQON Barrier Cream with its silver lid and a cream texture detail"},
  ]:[
    {src:"/images/supplements/12_hero_creatine_scoop.webp",alt:"IQON Creatine Monohydrate with an open jar and a measured scoop"},
    {src:"/images/supplements/16_hero_colostrum_open.webp",alt:"An open IQON Colostrum Powder jar with its scoop"},
  ];
  const rail=useRef<HTMLDivElement>(null);
  const headingId=useId();
  const isSample=designPreview&&reviews.length===0;
  const hasCards=reviews.length>0||isSample;
  const average=reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:0;
  const [canPrevious,setCanPrevious]=useState(false);
  const [canNext,setCanNext]=useState(true);
  const updateControls=()=>{const e=rail.current;if(e){setCanPrevious(e.scrollLeft>2);setCanNext(e.scrollLeft+e.clientWidth<e.scrollWidth-2);}};
  useEffect(()=>{
    const e=rail.current;if(!e)return;
    // Begin with a partial photograph at the edge, as in the reference. Every card remains reachable.
    if(window.matchMedia('(min-width:761px)').matches)e.scrollLeft=100;
    const observer=new ResizeObserver(updateControls);observer.observe(e);updateControls();
    return ()=>observer.disconnect();
  },[hasCards]);
  const move=(direction:number)=>{const e=rail.current;if(e)e.scrollBy({left:direction*(window.matchMedia('(max-width:760px)').matches?e.clientWidth*.75:e.clientWidth*.65),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <section className={`skin-community ${skin?"":"supplement-community"} ${hasCards?'has-reviews':'awaiting-reviews'}`} id={`${category}-reviews`} aria-labelledby={headingId}>
    <div className="skin-community-heading">{hasCards&&<ReviewStars rating={isSample?5:average} sample={isSample}/>}<h2 id={headingId}>{isSample?'Reviews · Design preview':reviews.length?'Real reviews':(skin?'Your skin. Your story.':'Your routine. Your story.')}</h2>{reviews.length>0&&<span>{average.toFixed(1)} / 5 · {reviews.length} {reviews.length===1?'review':'reviews'}</span>}</div>
    {isSample&&<p className="skin-review-preview-note">Sample layout with IQON brand imagery and copy. Customer reviews to be supplied.</p>}
    {hasCards?<>
      <div className="skin-review-carousel">
        <div className="skin-review-rail" ref={rail} onScroll={updateControls} tabIndex={0} role="region" aria-label={isSample?`${category} review layout preview`:`${category} customer reviews`}>
          {isSample?cards.map(card=><article className={`skin-review-card ${card.image?'skin-review-with-media':''}`} key={card.id}>
            {card.image?<><div className="skin-review-media"><img src={card.image} alt={card.alt} width={600} height={800} loading="lazy"/></div><footer>IQON brand imagery</footer></>:<div className="skin-review-quote"><ReviewStars rating={5} sample/><blockquote>{card.title}</blockquote><footer><strong>Design sample</strong><span>Brand copy · not a customer review</span></footer></div>}
          </article>):reviews.map(review=>{
            const product=products.find(p=>p.id===review.productId);
            return <article className={`skin-review-card ${review.media?'skin-review-with-media':''}`} key={review.id}>
              {review.media?<><div className="skin-review-media">{review.media.type==='video'?<video controls playsInline preload="none" poster={review.media.poster} aria-label={review.media.alt}><source src={review.media.src}/>{review.media.alt}</video>:<img src={review.media.src} alt={review.media.alt} width={600} height={800} loading="lazy"/>}</div><footer>{review.author}</footer></>:<div className="skin-review-quote"><ReviewStars rating={review.rating}/><blockquote>{review.title||review.text}</blockquote><footer><strong>{review.author}</strong>{review.verifiedPurchase&&<span>Verified buyer <BadgeCheck size={12} fill="currentColor" strokeWidth={1}/></span>}</footer></div>}
              {product&&<Link className="skin-review-product" href={`/products/${product.id}`}>{product.name}<ArrowUpRight size={12}/></Link>}
            </article>;
          })}
        </div>
        <div className="skin-review-arrows"><button onClick={()=>move(-1)} disabled={!canPrevious} aria-label={`Previous ${category} reviews`}><ArrowLeft size={19}/></button><button onClick={()=>move(1)} disabled={!canNext} aria-label={`More ${category} reviews`}><ArrowRight size={19}/></button></div>
      </div>
      <div className="skin-review-controls"><Link className="button button-outline" href={reviewHref}>Read all reviews</Link></div>
    </>:<div className="skin-community-intro" tabIndex={0} role="region" aria-label={`IQON ${category} brand stories`}>
      <figure><img src={introImages[0].src} alt={introImages[0].alt} width={1086} height={1448} loading="lazy"/><figcaption>The daily ritual</figcaption></figure>
      <div className="skin-community-note"><p className="eyebrow">CUSTOMER REVIEWS</p><h3>{skin?"Every skin.":"Every routine."}<br/>A story to tell.</h3><p>Customer reviews will appear here after launch.</p><Link className="under-link" href={reviewHref}>Visit customer reviews<ArrowUpRight size={15}/></Link></div>
      <figure><img src={introImages[1].src} alt={introImages[1].alt} width={1086} height={1448} loading="lazy"/><figcaption>The everyday essentials</figcaption></figure>
    </div>}
  </section>;
}
