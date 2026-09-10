"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useStore } from "../store-shell";
import { ProductRail } from "../product-rail";
import { JournalPreview, SkincareCampaign } from "../editorial";
import { CampaignHero } from "../campaign-hero";
import { customerReviews } from "@/lib/reviews";
import { approvedSkincareResults } from "@/lib/skincare-results";
import { SkincareDiscovery, SkincareReviews, SkinResults } from "./skincare-sections";
import "./skincare.css";
export function SkincareHome(){
 const {products}=useStore();const skin=products.filter(p=>p.category==="skincare");
 return <main id="main" className="skincare-home"><CampaignHero skincare featured={skin.find(p=>p.type==="Serum")||skin[0]}/><div className="skincare-step-rail"><Link href="/products/gentle-cleanser">Cleanse</Link><Link href="/products/peptide-serum">Treat</Link><Link href="/products/barrier-cream">Moisturize</Link></div>
 <section className="skincare-home-products section-pad commerce-featured" id="routine"><div className="section-heading"><div><p className="eyebrow">THE SKINCARE COLLECTION</p><h2>The everyday skincare ritual.</h2></div><Link href="/collections/skincare" className="button button-outline">Shop all skincare<ArrowRight size={18}/></Link></div><ProductRail products={skin} label="skincare products"/><Link href="/collections/skincare" className="button button-outline mobile-collection-action">Shop all skincare<ArrowRight size={18}/></Link></section>
 <SkincareCampaign/>
 <SkinResults results={approvedSkincareResults} products={skin}/>
 <SkincareReviews reviews={customerReviews.filter(r=>skin.some(p=>p.id===r.productId))} products={skin}/>
 <SkincareDiscovery/>
 <JournalPreview skincare/>
 </main>;
}
