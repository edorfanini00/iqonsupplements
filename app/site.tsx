"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampaignHero } from "./campaign-hero";
import { useStore } from "./store-shell";
import { ProductRail } from "./product-rail";
import { HumanStory, JournalPreview, SkincareCampaign } from "./editorial";
import { CustomerReviews } from "./customer-reviews";

export function IQONSite(){
 const {products}=useStore();
 const supplements=products.filter(p=>p.category==="supplements");
 const featured=supplements[0]||products[0];
 return <main id="main" className="iqon-home">
  <CampaignHero featured={featured}/>
  <div className="collection-rail"><Link href="/collections/supplements"><span>01</span> Supplements <ArrowRight size={16}/></Link><p>Supplements and skincare. Together, IQON.</p><Link href="/collections/skincare"><span>02</span> Skincare <ArrowRight size={16}/></Link></div>

  <section className="featured section-pad commerce-featured" id="collection"><div className="section-heading"><div><p className="eyebrow">THE SUPPLEMENT COLLECTION</p><h2>Your routine starts here.</h2></div><Link href="/collections/supplements" className="button button-outline">Shop all supplements<ArrowRight size={18}/></Link></div><ProductRail products={supplements}/><Link href="/collections/supplements" className="button button-outline mobile-collection-action">Shop all supplements<ArrowRight size={18}/></Link></section>
  <HumanStory movement/>
  <JournalPreview/>
  <SkincareCampaign crosslink/>
  <CustomerReviews/>
 </main>;
}
