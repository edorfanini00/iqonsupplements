"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CampaignHero } from "./campaign-hero";
import { ProductCard, useStore } from "./store-shell";
import { CollectionGuide } from "./collection-guide";
import { EverydayNote, HumanStory, JournalPreview } from "./editorial";
import { CustomerReviews } from "./customer-reviews";

export function IQONSite(){
 const {products}=useStore();
 const supplements=products.filter(p=>p.category==="supplements");
 const featured=supplements[0]||products[0];
 const [tab,setTab]=useState("essentials");
 const essentials=["creatine-monohydrate","hydrolyzed-collagen-peptides","nmn","resveratrol"].map(id=>supplements.find(p=>p.id===id)).filter((p):p is typeof supplements[number]=>!!p);
 return <main id="main" className="iqon-home">
  <CampaignHero featured={featured}/>
  <div className="collection-rail"><Link href="/collections/supplements"><span>01</span> Supplements <ArrowRight size={16}/></Link><p>Supplements and skincare. Together, IQON.</p><Link href="/collections/skincare"><span>02</span> Skincare <ArrowRight size={16}/></Link></div>

  <EverydayNote/>
  <section className="featured section-pad" id="collection">
   <Tabs value={tab} onValueChange={setTab}><div className="section-heading"><div><p className="eyebrow">THE SUPPLEMENT COLLECTION</p><h2>Your routine starts here.</h2></div><Link href="/collections/supplements" className="under-link">Shop all supplements<ArrowUpRight size={16}/></Link></div><TabsList variant="line" className="collection-tabs"><TabsTrigger value="essentials">Daily essentials</TabsTrigger><TabsTrigger value="Powder">Powders</TabsTrigger><TabsTrigger value="Capsules">Capsules</TabsTrigger></TabsList>{["essentials","Powder","Capsules"].map(value=><TabsContent key={value} value={value}><div className="product-grid home-product-grid">{(value==="essentials"?essentials:supplements.filter(p=>p.type===value).slice(0,4)).map(p=><ProductCard key={p.id} product={p}/>)}</div></TabsContent>)}</Tabs>
  </section>
  <HumanStory movement/>
  <CollectionGuide department="supplements"/>
  <section className="material-story"><div className="material-copy"><p className="eyebrow">THE IQON APPROACH</p><h2>The details<br/>deserve attention.</h2><p>Understand the ingredient. Look at the complete label. Choose a format that fits your day.</p><Accordion type="single" collapsible defaultValue="clarity" className="brand-principles">{[{id:"clarity",title:"Know what’s inside",text:"The ingredient list and Supplement Facts panel belong together. Read both before choosing a supplement."},{id:"detail",title:"Compare like with like",text:"Pack size and serving size describe different things. Check the amount per serving alongside the amount in the container."},{id:"routine",title:"Make room for your routine",text:"Powders, capsules, sachets and gummies offer different formats. Get to know the product first, then decide how it fits your day."}].map((item,i)=><AccordionItem key={item.id} value={item.id}><AccordionTrigger><span className="principle-label"><small>0{i+1}</small>{item.title}</span></AccordionTrigger><AccordionContent>{item.text}</AccordionContent></AccordionItem>)}</Accordion><Link href="/journal/reading-a-supplement-label" className="under-link">The details worth reading<ArrowUpRight size={16}/></Link></div><div className="material-image"><img src="/images/store/precision.webp" alt="Macro study of clear serum and precisely machined silver" width={1600} height={1200} loading="lazy"/></div></section>
  <JournalPreview/>
  <section className="skin-story"><div className="skin-story-photo"><img src="/images/store/campaign-skincare.webp" alt="The IQON skincare collection with serum texture and silver details" width={1920} height={1080} loading="lazy"/></div><div className="skin-story-copy"><p className="eyebrow">ALSO FROM IQON</p><h2>A new chapter.<br/>For your skin.</h2><p>A cleanser, a serum, a moisturizer. Discover the next expression of IQON.</p><Link href="/skincare" className="button button-dark">Explore skincare<ArrowRight size={18}/></Link><div className="ritual-mini"><span>01 / CLEANSE</span><span>02 / TREAT</span><span>03 / MOISTURIZE</span></div></div></section>
  <CustomerReviews/>
 </main>;
}
