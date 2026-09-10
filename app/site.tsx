"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CampaignHero } from "./campaign-hero";
import { useStore } from "./store-shell";
import { ProductRail } from "./product-rail";
import { HumanStory, JournalPreview, SupplementCampaign } from "./editorial";
import { CommunityReviews } from "./community-reviews";
import { customerReviews } from "@/lib/reviews";

export function IQONSite({designPreview=false}:{designPreview?:boolean}){
 const {products,mode}=useStore();
 const supplements=products.filter(p=>p.category==="supplements");
 const featured=supplements[0]||products[0];
 return <main id="main" className="iqon-home">
  <CampaignHero featured={featured}/>
  <div className="collection-rail"><Link href="/collections/supplements"><span>01</span> Supplements <ArrowRight size={16}/></Link><p>Supplements and skincare. Together, IQON.</p><Link href="/collections/skincare"><span>02</span> Skincare <ArrowRight size={16}/></Link></div>

  <section className="featured section-pad commerce-featured" id="collection"><div className="section-heading"><div><p className="eyebrow">THE SUPPLEMENT COLLECTION</p><h2>Your routine starts here.</h2></div><Link href="/collections/supplements" className="button button-outline">Shop all supplements<ArrowRight size={18}/></Link></div><ProductRail products={supplements}/><Link href="/collections/supplements" className="button button-outline mobile-collection-action">Shop all supplements<ArrowRight size={18}/></Link></section>
  <HumanStory movement/>
  <JournalPreview/>
  <SupplementCampaign/>
  <CommunityReviews category="supplements" products={supplements} reviews={customerReviews.filter(review=>supplements.some(product=>product.id===review.productId))} designPreview={designPreview&&mode==="preview"}/>
 </main>;
}
