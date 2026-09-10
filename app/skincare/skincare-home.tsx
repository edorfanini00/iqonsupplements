"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useStore } from "../store-shell";
import { ProductRail } from "../product-rail";
import { HumanStory, JournalPreview } from "../editorial";
import { CampaignHero } from "../campaign-hero";
import { CustomerReviews } from "../customer-reviews";
export function SkincareHome(){
 const {products}=useStore();const skin=products.filter(p=>p.category==="skincare");
 return <main id="main" className="skincare-home"><CampaignHero skincare featured={skin.find(p=>p.type==="Serum")||skin[0]}/><div className="skincare-step-rail"><Link href="/products/gentle-cleanser">Cleanse</Link><Link href="/products/peptide-serum">Treat</Link><Link href="/products/barrier-cream">Moisturize</Link></div>
 <section className="skincare-home-products section-pad commerce-featured" id="routine"><div className="section-heading"><div><p className="eyebrow">THE SKINCARE COLLECTION</p><h2>Your skin.<br/>Your essentials.</h2></div><Link href="/collections/skincare" className="button button-dark">Shop all skincare<ArrowRight size={18}/></Link></div><ProductRail products={skin} label="skincare products"/><Link href="/collections/skincare" className="button button-outline mobile-collection-action">Shop all skincare<ArrowRight size={18}/></Link></section>
 <section className="skin-product-feature"><picture><source media="(max-width:760px)" srcSet="/images/editorial/iqon-serum-mobile.webp"/><img src="/images/editorial/iqon-serum-desktop.webp" alt="A close look at the IQON Peptide Serum bottle and its silver details" width={1536} height={1024} loading="lazy"/></picture><div><p className="eyebrow">IQON SKINCARE</p><h2>A few essentials.<br/>A moment for your skin.</h2><Link className="button button-dark" href="/products/peptide-serum">Discover Peptide Serum<ArrowRight size={18}/></Link></div></section>
 <HumanStory skincare/>
 <JournalPreview skincare/>
 <CustomerReviews/>
 <section className="department-discovery"><img src="/images/supplements/22_group_powders_row.webp" alt="The IQON powder supplement collection" width={2400} height={1340} loading="lazy"/><div><p className="eyebrow">ALSO FROM IQON</p><h2>Meet your<br/>daily essentials.</h2><p>Creatine, collagen and more. Discover the IQON supplement collection.</p><Link href="/" className="button button-dark">Explore supplements<ArrowRight size={17}/></Link></div></section>
 </main>;
}
