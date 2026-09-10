"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useStore } from "../store-shell";
import { ProductRail } from "../product-rail";
import { HumanStory, JournalPreview, SkincareCampaign } from "../editorial";
import { CampaignHero } from "../campaign-hero";
import { CustomerReviews } from "../customer-reviews";
export function SkincareHome(){
 const {products}=useStore();const skin=products.filter(p=>p.category==="skincare");
 return <main id="main" className="skincare-home"><CampaignHero skincare featured={skin.find(p=>p.type==="Serum")||skin[0]}/><div className="skincare-step-rail"><Link href="/products/gentle-cleanser">Cleanse</Link><Link href="/products/peptide-serum">Treat</Link><Link href="/products/barrier-cream">Moisturize</Link></div>
 <section className="skincare-home-products section-pad commerce-featured" id="routine"><div className="section-heading"><div><p className="eyebrow">THE SKINCARE COLLECTION</p><h2>The everyday skincare ritual.</h2></div><Link href="/collections/skincare" className="button button-outline">Shop all skincare<ArrowRight size={18}/></Link></div><ProductRail products={skin} label="skincare products"/><Link href="/collections/skincare" className="button button-outline mobile-collection-action">Shop all skincare<ArrowRight size={18}/></Link></section>
 <SkincareCampaign/>
 <HumanStory skincare/>
 <JournalPreview skincare/>
 <CustomerReviews/>
 </main>;
}
