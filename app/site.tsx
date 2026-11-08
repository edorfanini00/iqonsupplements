"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useStore } from "./store-shell";
import { ProductRail } from "./product-rail";
import { JournalPreview } from "./editorial";
import { CommunityReviews } from "./community-reviews";
import { customerReviews } from "@/lib/reviews";

export function IQONSite(){
 const {products}=useStore();
 const supplements=products.filter(p=>p.category==="supplements");
 const featured=supplements.find(p=>p.id==="colostrum-powder")||supplements[0];
 const edit=["colostrum-powder","creatine-monohydrate","hydrolyzed-collagen-peptides"].flatMap(id=>supplements.filter(p=>p.id===id));
 const creatine=supplements.find(p=>p.id==="creatine-monohydrate");
 const reviews=customerReviews.filter(review=>supplements.some(p=>p.id===review.productId));
 return <main id="main" className="iqon-home premium-home">
  <section className="home-opening section-pad">
   <div className="home-opening-copy"><p className="eyebrow">IQON SUPPLEMENTS</p><h1>Make room for <br/>feeling your best.</h1><p>Creatine for your training. Collagen for your favorite drink. Daily nutrients in capsules and gummies. Discover supplements that fit the way you live.</p><Link href="/collections/supplements" className="button button-dark">Shop supplements<ArrowRight size={18}/></Link><Link href="/approach" className="home-learning-link">Meet IQON<ArrowUpRight size={15}/></Link></div>
   {featured&&<Link className="home-opening-image" href={`/products/${featured.id}`} aria-label={`Explore ${featured.name}`}><img src={featured.image} alt={`IQON ${featured.name} packaging`} width={1122} height={1402} fetchPriority="high"/><span>{featured.name}<ArrowUpRight size={20}/></span></Link>}
  </section>
  <section className="featured section-pad commerce-featured home-edit" id="collection"><div className="section-heading"><div><h2>Find your starting point.</h2><p>A small edit from the collection, from your training session to your daily drink.</p></div><Link href="/collections/supplements" className="under-link">All supplements<ArrowRight size={18}/></Link></div><ProductRail products={edit}/></section>
  {creatine&&<section className="home-feature section-pad"><img src="/images/supplement-materials-v1/creatine-monohydrate.webp" alt="White powder in a metal scoop on a charcoal surface" width={1122} height={1402} loading="lazy"/><div><p className="eyebrow">CREATINE MONOHYDRATE</p><h2>Support the<br/>strength you build.</h2><p>For the sets, sprints and sessions you keep showing up for. Creatine monohydrate supports repeated, high intensity exercise alongside training.*</p><p className="home-fact-note">Unflavored, with no added caffeine or sweeteners. Each serving provides 5 g of creatine monohydrate. Follow the full loading and maintenance directions.</p><Link href={`/products/${creatine.id}`} className="under-link">Explore creatine<ArrowUpRight size={18}/></Link><p className="home-claim-note">*These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.</p></div></section>}
  <section className="home-standards section-pad"><h2>Your day.<br/>Your preferences.</h2><div><article><h3>Keep it simple.</h3><p>Choose single ingredient creatine or unflavored collagen when you want a powder without added flavors or sweeteners.</p></article><article><h3>Find a flavor you enjoy.</h3><p>Explore chocolate collagen with cocoa and stevia, or passion fruit gummies with vitamins and minerals.</p></article><article><h3>Choose your format.</h3><p>A powder to mix, a capsule with water or a gummy to chew. Each product has its own directions and ingredients.</p></article><Link className="under-link" href="/approach">Our approach<ArrowUpRight size={16}/></Link></div></section>
  {featured?.id==="colostrum-powder"&&<section className="home-preparation section-pad"><div><p className="eyebrow">COLOSTRUM POWDER</p><h2>A cold drink.<br/>A measured scoop.</h2><p>Mix one scoop with 6 to 8 oz of cold water or your favorite beverage. Consume within ten minutes of preparing.</p><p className="home-fact-note">Contains milk. For adults. Read the complete directions and warnings before use.</p><Link href="/products/colostrum-powder#product-routine" className="under-link">See how to prepare it<ArrowUpRight size={16}/></Link></div><img src="/images/product-editorial/colostrum-powder.webp" alt="IQON Colostrum Powder beside a cold drink and a scoop of powder" width={1122} height={1402} loading="lazy"/></section>}
  <JournalPreview/>
  {reviews.length>0&&<CommunityReviews category="supplements" products={supplements} reviews={reviews}/>}
  <section className="home-shop-end section-pad"><div><h2>Find your formula.</h2><p>Explore the full supplement collection and preview the skincare range.</p></div><Link href="/collections/all" className="button button-dark">Shop all<ArrowRight size={18}/></Link></section>
 </main>;
}
