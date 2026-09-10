"use client";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CampaignHero } from "./campaign-hero";
import { useStore } from "./store-shell";
import { ProductRail } from "./product-rail";
import { HumanStory, JournalPreview } from "./editorial";
import { CustomerReviews } from "./customer-reviews";

export function IQONSite(){
 const {products}=useStore();
 const supplements=products.filter(p=>p.category==="supplements");
 const featured=supplements[0]||products[0];
 return <main id="main" className="iqon-home">
  <CampaignHero featured={featured}/>
  <div className="collection-rail"><Link href="/collections/supplements"><span>01</span> Supplements <ArrowRight size={16}/></Link><p>Supplements and skincare. Together, IQON.</p><Link href="/collections/skincare"><span>02</span> Skincare <ArrowRight size={16}/></Link></div>

  <section className="featured section-pad commerce-featured" id="collection"><div className="section-heading"><div><p className="eyebrow">THE SUPPLEMENT COLLECTION</p><h2>Find your everyday essentials.</h2></div><Link href="/collections/supplements" className="button button-dark">Shop all supplements<ArrowRight size={18}/></Link></div><ProductRail products={supplements}/><Link href="/collections/supplements" className="button button-outline mobile-collection-action">Shop all supplements<ArrowRight size={18}/></Link></section>
  <HumanStory movement/>
  <section className="material-story"><div className="material-copy"><p className="eyebrow">THE IQON APPROACH</p><h2>The details<br/>deserve attention.</h2><p>Understand the ingredient. Look at the complete label. Choose a format that fits your day.</p><Accordion type="single" collapsible className="brand-principles">{[{id:"clarity",title:"Know what’s inside",text:"The ingredient list and Supplement Facts panel belong together. Read both before choosing a supplement."},{id:"detail",title:"Compare like with like",text:"Pack size and serving size describe different things. Check the amount per serving alongside the amount in the container."},{id:"routine",title:"Make room for your routine",text:"Powders, capsules, sachets and gummies offer different formats. Get to know the product first, then decide how it fits your day."}].map((item,i)=><AccordionItem key={item.id} value={item.id}><AccordionTrigger><span className="principle-label"><small>0{i+1}</small>{item.title}</span></AccordionTrigger><AccordionContent>{item.text}</AccordionContent></AccordionItem>)}</Accordion><Link href="/journal/reading-a-supplement-label" className="under-link">The details worth reading<ArrowUpRight size={16}/></Link></div><div className="material-image"><img src="/images/store/precision.webp" alt="Macro study of clear serum and precisely machined silver" width={1600} height={1200} loading="lazy"/></div></section>
  <JournalPreview/>
  <section className="skin-story"><div className="skin-story-photo"><img src="/images/store/campaign-skincare.webp" alt="The IQON skincare collection with serum texture and silver details" width={1920} height={1080} loading="lazy"/></div><div className="skin-story-copy"><p className="eyebrow">ALSO FROM IQON</p><h2>A new chapter.<br/>For your skin.</h2><p>A cleanser, a serum, a moisturizer. Discover the next expression of IQON.</p><Link href="/skincare" className="button button-dark">Explore skincare<ArrowRight size={18}/></Link><div className="ritual-mini"><span>01 / CLEANSE</span><span>02 / TREAT</span><span>03 / MOISTURIZE</span></div></div></section>
  <CustomerReviews/>
 </main>;
}
