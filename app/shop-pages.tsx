"use client";
import Link from "next/link";
import { trackViewContent } from "@/lib/meta-pixel";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, RotateCcw, Truck } from "lucide-react";
import { ProductBundleOptions } from "./product-bundle-options";
import { bundleEstimate, isBundleEligible } from "@/lib/bundle-offer";
import { SHIPPING_NOTE, isComingSoon, isOrderable } from "@/lib/commerce-policy";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ProductGallery } from "./product-gallery";
import { productVisuals } from "@/lib/product-visuals";
import { packageContents } from "@/lib/product-art";
import { money, unitPrice, type Product } from "@/lib/catalog";
import { CartConnectionNotice, Quantity, useStore } from "./store-shell";
import { productContent } from "@/lib/product-content";
import { ProductStory } from "./product-story";
import { ProductEssentials } from "./product-essentials";
import { ProductSwitcher } from "./product-navigation";
import { ProductRail } from "./product-rail";
import { CustomerReviews, ProductReviewLink } from "./customer-reviews";
import skincareRange from "@/lib/skincare-range.json";
import { supplementDetails } from "@/lib/supplement-details";
import { SupplementFormula, SupplementDirections } from "./supplement-information";
import { ProductGuides } from "./buyer-paths";
import { STORE_POLICIES } from "@/lib/store-policies";
import "./purchase-clarity.css";

export { CollectionPage } from "./collection-page";

export function ProductPage({product:p,designPreview=false}:{product:Product;designPreview?:boolean}){
 const {add,products,mode,busy,ready}=useStore();
 const live=mode==="live";
 const comingSoon=isComingSoon(p)||!!p.pricePending;
 const skin=skincareRange.find(item=>item.id===p.id);
 const content=productContent[p.id];
 const [variantId,setVariantId]=useState(p.variants?.find(v=>v.available)?.id||p.variants?.[0]?.id||"");
 const variant=p.variants?.find(v=>v.id===variantId);
 const [quantity,setQuantity]=useState(1);
 const available=!comingSoon&&p.available!==false&&variant?.available!==false&&!p.requiresSellingPlan;
 const supplement=supplementDetails[p.id];
 const price=variant?.price??unitPrice(p);
 const currency=variant?.currency||p.currency||"USD";
 // Bundle eligible products show the tiers; the add button shows this selection's own estimate.
 const bundle=p.category==="supplements"&&isBundleEligible(p.id);
 const estimate=bundle?bundleEstimate(price,quantity):{gross:Math.round(price*100)*quantity/100,total:Math.round(price*100)*quantity/100,saved:0};
 useEffect(()=>{
  if(live&&variantId&&!comingSoon)trackViewContent({variantId,name:p.name,price,currency});
 },[live,variantId,comingSoon,p.name,price,currency]);
 const purchaseFirst=["creatine-monohydrate","hydrolyzed-collagen-peptides","colostrum-powder"].includes(p.id);
 const inlineCta=useRef<HTMLDivElement>(null);
 const [inlineCtaInView,setInlineCtaInView]=useState(true);
 useEffect(()=>{
  const row=inlineCta.current;
  if(!purchaseFirst||!row||typeof IntersectionObserver==="undefined")return;
  const observer=new IntersectionObserver(([entry])=>setInlineCtaInView(entry.isIntersecting));
  observer.observe(row);
  return()=>observer.disconnect();
 },[purchaseFirst,comingSoon]);
 const related=products.filter(other=>other.category===p.category&&other.id!==p.id);
 const addSelection=()=>add(p.id,quantity,variantId);
 const addLabel=<>{!available?"Currently unavailable":busy?"Updating…":"Add to bag"} <span>{estimate.saved>0&&<s>{money(estimate.gross,currency)}</s>}{money(estimate.total,currency)}</span></>;
 const gallery=<ProductGallery key={p.id} product={p}/>;
 const panelTop=<><div className="product-summary"><p className="eyebrow">{p.category.toUpperCase()} / {p.type.toUpperCase()}</p><div className="product-title-row"><h1>{p.name}</h1><span className={comingSoon?"price-pending":""}>{comingSoon?"Coming soon":money(price,currency)}</span></div>{<p className="product-size">{variant?.title&&variant.title!=="Default Title"?variant.title:packageContents(p)}{p.ritual&&<> <span>·</span> {p.ritual}</>}</p>}</div><ProductReviewLink productId={p.id} designPreview={designPreview&&mode==="preview"}/>{content&&<p className="product-summary-description">{productVisuals[p.id]?.lead || content.description}</p>}{content&&<ul className="product-highlights">{content.highlights.map(highlight=><li key={highlight}><Check size={15}/><span>{highlight}</span></li>)}</ul>}<ProductEssentials product={p} price={price} currency={currency}/>{!comingSoon&&p.variants&&p.variants.length>1?<div className="product-variant-picker"><label htmlFor="product-variant">Select option</label><select id="product-variant" value={variantId} onChange={e=>setVariantId(e.target.value)}>{p.variants.map(v=><option key={v.id} value={v.id}>{v.title}{!v.available?" — Sold out":""}</option>)}</select></div>:p.size&&<div className="product-format"><span>FORMAT</span><strong>{p.size}</strong><Check size={15}/></div>}{!comingSoon&&<>
 {bundle&&available&&<ProductBundleOptions quantity={quantity} setQuantity={setQuantity} price={price} currency={currency}/>}
 <CartConnectionNotice/>
 <div className="add-to-bag-row" ref={inlineCta}><Quantity value={quantity} setValue={setQuantity} label={p.name} disabled={busy||!available}/><button className="button button-dark" disabled={busy||!ready||!available} onClick={addSelection}>{addLabel}</button></div>
 {!live&&<p className="product-preview-note">Orders will open shortly.</p>}
 {purchaseFirst&&isOrderable(p,mode)&&<ul className="purchase-assurance">
  <li><Truck size={15} aria-hidden="true"/><span>Shipping usually takes 3 to 5 days. Cost shown at checkout. <a href={STORE_POLICIES.shipping.href}>Shipping policy</a></span></li>
  <li><RotateCcw size={15} aria-hidden="true"/><span>Unopened, unused products can be returned within 30 days of delivery. <a href={STORE_POLICIES.refund.href}>Returns</a></span></li>
 </ul>}
 </>}
 {comingSoon&&<div className="product-launch-note skincare-launch-note"><p className="launch-status">Coming soon</p><p>Our skincare collection is on its way. Explore the formulas and find your future ritual.</p><button className="button button-dark full-width" disabled>Not available to order yet</button><Link href="/collections/supplements" className="under-link">Explore supplements <ArrowUpRight size={16}/></Link></div>}</>;
 const panelRest=<>
 {/* Targets exist only in the editorial ProductStory; generic Shopify products have none. */}
 {content&&<div className="product-jump-links"><a href="#product-formula">Explore ingredients <ArrowRight size={14}/></a>{content.routine&&<a href="#product-routine">How to use <ArrowRight size={14}/></a>}</div>}<Accordion type="single" collapsible className="product-accordion"><AccordionItem value="details"><AccordionTrigger>Product details</AccordionTrigger><AccordionContent><p>{p.description}</p><dl><div><dt>Collection</dt><dd>{p.category}</dd></div><div><dt>Format</dt><dd>{packageContents(p)}</dd></div>{p.ritual&&<div><dt>Step / focus</dt><dd>{p.ritual}</dd></div>}{supplement&&<><div><dt>Made in</dt><dd>{supplement.country}</dd></div>{supplement.flavor&&<div><dt>Flavor</dt><dd>{supplement.flavor}</dd></div>}{supplement.netWeight&&<div><dt>Net weight</dt><dd>{supplement.netWeight}</dd></div>}<div><dt>Contents</dt><dd>{supplement.contents}</dd></div></>}</dl>{!live&&!supplement&&!skin&&<p>{p.pricePending?"The final label will include serving size, ingredients and directions before orders open.":"This skincare collection is in development. The final formula and application directions will be published before launch."}</p>}</AccordionContent></AccordionItem>{(!live||skin||supplement)&&<><AccordionItem value="formula"><AccordionTrigger>{p.category==="skincare"?"Ingredients & formulation":"Ingredients & listed amounts"}</AccordionTrigger><AccordionContent>{skin?<p><strong>Key ingredients:</strong> {skin.ingredients}. Refer to the packaging for the current ingredient list.</p>:supplement?<SupplementFormula details={supplement}/>:<>The full ingredient list and {p.category==="skincare"?"formula details":"Supplement Facts panel"} will be available before orders open.</>}</AccordionContent></AccordionItem><AccordionItem value="use"><AccordionTrigger>How to use</AccordionTrigger><AccordionContent>{skin?<p>{skin.directions}</p>:supplement?<SupplementDirections details={supplement}/>:<>{p.category==="skincare"?`The proposed place for ${p.name} is the ${p.ritual.toLowerCase()} step. `:""}Follow the approved product label for amounts and frequency when the collection launches.</>}</AccordionContent></AccordionItem></>}{/* The shipping window applies only to something a shopper can order now (not coming soon, sold out or preview). */}{isOrderable(p,mode)&&<AccordionItem value="shipping"><AccordionTrigger>Shipping</AccordionTrigger><AccordionContent>{SHIPPING_NOTE}</AccordionContent></AccordionItem>}</Accordion><ProductGuides product={p}/></>;
 return <main id="main" className={`product-page${purchaseFirst?" purchase-first":""}`}><ProductSwitcher product={p} products={products}/><nav className="breadcrumbs product-breadcrumbs section-pad" aria-label="Breadcrumb"><Link href="/">IQON</Link><ChevronRight size={12}/><Link href={`/collections/${p.category}`}>{p.category}</Link><ChevronRight size={12}/><span>{p.name}</span></nav><section id="overview" className={`product-detail section-pad ${p.category==="supplements"?"supplied-product-detail":"skincare-product-detail"}`}>{purchaseFirst
  // Keep the purchase controls before the gallery in the DOM as well as on phones.
  ?<><div className="purchase-panel">{panelTop}</div>{gallery}<div className="purchase-panel purchase-panel-details">{panelRest}</div></>
  :<>{gallery}<div className="purchase-panel">{panelTop}{panelRest}</div></>}</section>
 {content?<ProductStory product={p} products={products}/>:<section className={`pdp-editorial ${p.pricePending?"supplied-editorial":""}`}><img src={p.campaign} alt={`The IQON ${p.category} collection in the studio`} width={1920} height={1080} loading="lazy"/><div><p className="eyebrow">CONSIDERED, TO THE LAST DETAIL</p><h2>{p.category==="skincare"?<>A place for<br/>every step.</>:<>Make room for<br/>the everyday.</>}</h2><p>{p.category==="skincare"?"A focused collection brings the first cleanse, treatment and moisturizing steps into one point of view.":"A considered routine starts with clarity. Explore the collection, compare the formats and find the essentials that fit your everyday."}</p><Link className="under-link" href="/approach">Our approach <ArrowUpRight size={16}/></Link></div></section>}
 <CustomerReviews productId={p.id} productName={p.name} designPreview={designPreview&&mode==="preview"}/><section className="related-products section-pad"><div className="section-heading"><div><p className="eyebrow">EXPLORE THE COLLECTION</p><h2>{p.category==="skincare"?"Complete your ritual.":"Explore more supplements."}</h2></div><Link href={`/collections/${p.category}`} className="under-link">{p.category==="skincare"?"Explore skincare":"Shop supplements"} <ArrowUpRight size={16}/></Link></div><ProductRail products={related} label={p.category}/></section>{!comingSoon&&<div className={`sticky-purchase${purchaseFirst&&inlineCtaInView?" inline-cta-in-view":""}`}><div><img src={p.image} alt=""/><span>{p.name}<small>{packageContents(p)}</small></span></div><button className="button button-dark" disabled={busy||!ready||!available} onClick={addSelection}>{addLabel}</button></div>}</main>;
}
