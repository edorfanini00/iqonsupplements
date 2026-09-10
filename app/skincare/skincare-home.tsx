"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { ProductCard, useStore } from "../store-shell";
import { CollectionGuide } from "../collection-guide";
import { HumanStory, JournalPreview } from "../editorial";
import { CampaignHero } from "../campaign-hero";
import { CustomerReviews } from "../customer-reviews";
export function SkincareHome(){
 const {products}=useStore();const skin=products.filter(p=>p.category==="skincare");
 return <main id="main" className="skincare-home"><CampaignHero skincare featured={skin.find(p=>p.type==="Serum")||skin[0]}/><div className="skincare-step-rail"><a href="#routine">01 / Cleanse</a><a href="#routine">02 / Treat</a><a href="#routine">03 / Moisturize</a></div>
 <section className="skincare-home-products section-pad"><div className="section-heading"><div><p className="eyebrow">THE SKINCARE COLLECTION</p><h2>The essentials.<br/>For a routine that’s yours.</h2></div><Link href="/collections/skincare" className="under-link">Shop all skincare<ArrowUpRight size={16}/></Link></div><div className="product-grid">{skin.map(p=><ProductCard key={p.id} product={p}/>)}</div></section>
 <HumanStory skincare/>
 <div id="routine"><CollectionGuide department="skincare"/></div>
 <section className="skin-detail-story section-pad"><div><p className="eyebrow">A CLOSER LOOK</p><h2>Get to know<br/>what goes on your skin.</h2><p>The complete ingredient list. The application directions. The place of each product in your routine. Take a moment with the details before you choose.</p><Link href="/journal/a-simple-skincare-routine" className="under-link">A simple skincare routine<ArrowUpRight size={17}/></Link></div><img src="/images/store/precision.webp" alt="A close study of serum texture and brushed silver" width={1600} height={1200} loading="lazy"/></section>
 <JournalPreview skincare/>
 <CustomerReviews/>
 <section className="department-discovery"><img src="/images/supplements/22_group_powders_row.webp" alt="The IQON powder supplement collection" width={2400} height={1340} loading="lazy"/><div><p className="eyebrow">ALSO FROM IQON</p><h2>Meet your<br/>daily essentials.</h2><p>Creatine, collagen and more. Discover the IQON supplement collection.</p><Link href="/" className="button button-dark">Explore supplements<ArrowRight size={17}/></Link></div></section>
 </main>;
}
