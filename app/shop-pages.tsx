"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronRight } from "lucide-react";
import { ProductPurchaseOptions } from "./product-purchase-options";
import { isComingSoon } from "@/lib/commerce-policy";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ProductGallery } from "./product-gallery";
import { productVisuals } from "@/lib/product-visuals";
import { packageContents } from "@/lib/product-art";
import { money, unitPrice, type Product, type Purchase } from "@/lib/catalog";
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
 const [purchase,setPurchase]=useState<Purchase>("once");
 const [planId,setPlanId]=useState("");
 const plans=live&&!comingSoon?variant?.sellingPlans||[]:[];
 const plan=plans.find(option=>option.id===planId)||plans[0];
 const selectedPurchase:Purchase=p.requiresSellingPlan?"subscription":plan?purchase:"once";
 const selectedPlan=selectedPurchase==="subscription"?plan:undefined;
 const available=!comingSoon&&p.available!==false&&variant?.available!==false&&(!p.requiresSellingPlan||!!selectedPlan);
 const supplement=supplementDetails[p.id];
 const oneTimePrice=variant?.price??unitPrice(p);
 const price=selectedPlan?.price??oneTimePrice;
 const currency=selectedPlan?.currency||variant?.currency||p.currency||"USD";
 const related=products.filter(other=>other.category===p.category&&other.id!==p.id);
 const addSelection=()=>add(p.id,quantity,selectedPurchase,selectedPlan?.options.map(option=>option.value).join(" / ")||"once",variantId,selectedPlan?.id);
 return <main id="main" className="product-page"><ProductSwitcher product={p} products={products}/><nav className="breadcrumbs product-breadcrumbs section-pad" aria-label="Breadcrumb"><Link href="/">IQON</Link><ChevronRight size={12}/><Link href={`/collections/${p.category}`}>{p.category}</Link><ChevronRight size={12}/><span>{p.name}</span></nav><section id="overview" className={`product-detail section-pad ${p.category==="supplements"?"supplied-product-detail":"skincare-product-detail"}`}><ProductGallery key={p.id} product={p}/>
 <div className="purchase-panel"><div className="product-summary"><p className="eyebrow">{p.category.toUpperCase()} / {p.type.toUpperCase()}</p><div className="product-title-row"><h1>{p.name}</h1><span className={comingSoon?"price-pending":""}>{comingSoon?"Coming soon":money(price,currency)}</span></div>{<p className="product-size">{variant?.title&&variant.title!=="Default Title"?variant.title:packageContents(p)}{p.ritual&&<> <span>·</span> {p.ritual}</>}</p>}</div><ProductReviewLink productId={p.id} designPreview={designPreview&&mode==="preview"}/>{content&&<p className="product-summary-description">{productVisuals[p.id]?.lead || content.description}</p>}{content&&<ul className="product-highlights">{content.highlights.map(highlight=><li key={highlight}><Check size={15}/><span>{highlight}</span></li>)}</ul>}<ProductEssentials product={p} price={selectedPlan?.perDeliveryPrice??price} currency={currency}/>{!comingSoon&&p.variants&&p.variants.length>1?<div className="product-variant-picker"><label htmlFor="product-variant">Select option</label><select id="product-variant" value={variantId} onChange={e=>setVariantId(e.target.value)}>{p.variants.map(v=><option key={v.id} value={v.id}>{v.title}{!v.available?" — Sold out":""}</option>)}</select></div>:p.size&&<div className="product-format"><span>FORMAT</span><strong>{p.size}</strong><Check size={15}/></div>}{!comingSoon&&<>
 <ProductPurchaseOptions purchase={selectedPurchase} setPurchase={setPurchase} plan={plan} plans={plans} setPlanId={setPlanId} oneTimePrice={oneTimePrice} currency={currency} requiresSellingPlan={p.requiresSellingPlan}/>
 <CartConnectionNotice/>
 <div className="add-to-bag-row"><Quantity value={quantity} setValue={setQuantity} label={p.name} disabled={busy||!available}/><button className="button button-dark" disabled={busy||!ready||!available} onClick={addSelection}>{!available?"Currently unavailable":busy?"Updating…":selectedPurchase==="subscription"?"Add subscription":"Add to bag"} <span>{money(price*quantity,currency)}</span></button></div>
 {!live&&<p className="product-preview-note">Orders will open shortly.</p>}
 </>}
 {comingSoon&&<div className="product-launch-note skincare-launch-note"><p className="launch-status">Coming soon</p><p>Our skincare collection is on its way. Explore the formulas and find your future ritual.</p><button className="button button-dark full-width" disabled>Not available to order yet</button><Link href="/collections/supplements" className="under-link">Explore supplements <ArrowUpRight size={16}/></Link></div>}

 <div className="product-jump-links"><a href="#product-formula">Explore ingredients <ArrowRight size={14}/></a><a href="#product-routine">How to use <ArrowRight size={14}/></a></div><Accordion type="single" collapsible className="product-accordion"><AccordionItem value="details"><AccordionTrigger>Product details</AccordionTrigger><AccordionContent><p>{p.description}</p><dl><div><dt>Collection</dt><dd>{p.category}</dd></div><div><dt>Format</dt><dd>{packageContents(p)}</dd></div>{p.ritual&&<div><dt>Step / focus</dt><dd>{p.ritual}</dd></div>}{supplement&&<><div><dt>Made in</dt><dd>{supplement.country}</dd></div>{supplement.flavor&&<div><dt>Flavor</dt><dd>{supplement.flavor}</dd></div>}{supplement.netWeight&&<div><dt>Net weight</dt><dd>{supplement.netWeight}</dd></div>}<div><dt>Contents</dt><dd>{supplement.contents}</dd></div></>}</dl>{!live&&!supplement&&!skin&&<p>{p.pricePending?"The final label will include serving size, ingredients and directions before orders open.":"This skincare collection is in development. The final formula and application directions will be published before launch."}</p>}</AccordionContent></AccordionItem>{(!live||skin||supplement)&&<><AccordionItem value="formula"><AccordionTrigger>{p.category==="skincare"?"Ingredients & formulation":"Ingredients & listed amounts"}</AccordionTrigger><AccordionContent>{skin?<p><strong>Key ingredients:</strong> {skin.ingredients}. Refer to the packaging for the current ingredient list.</p>:supplement?<SupplementFormula details={supplement}/>:<>The full ingredient list and {p.category==="skincare"?"formula details":"Supplement Facts panel"} will be available before orders open.</>}</AccordionContent></AccordionItem><AccordionItem value="use"><AccordionTrigger>How to use</AccordionTrigger><AccordionContent>{skin?<p>{skin.directions}</p>:supplement?<SupplementDirections details={supplement}/>:<>{p.category==="skincare"?`The proposed place for ${p.name} is the ${p.ritual.toLowerCase()} step. `:""}Follow the approved product label for amounts and frequency when the collection launches.</>}</AccordionContent></AccordionItem></>}<AccordionItem value="shipping"><AccordionTrigger>Shipping</AccordionTrigger><AccordionContent>Available shipping options and costs are shown at checkout. Processing and delivery can vary by product and destination.</AccordionContent></AccordionItem></Accordion></div></section>
 {content?<ProductStory product={p} products={products}/>:<section className={`pdp-editorial ${p.pricePending?"supplied-editorial":""}`}><img src={p.campaign} alt={`The IQON ${p.category} collection in the studio`} width={1920} height={1080} loading="lazy"/><div><p className="eyebrow">CONSIDERED, TO THE LAST DETAIL</p><h2>{p.category==="skincare"?<>A place for<br/>every step.</>:<>Make room for<br/>the everyday.</>}</h2><p>{p.category==="skincare"?"A focused collection brings the first cleanse, treatment and moisturizing steps into one point of view.":"A considered routine starts with clarity. Explore the collection, compare the formats and find the essentials that fit your everyday."}</p><Link className="under-link" href="/approach">Our approach <ArrowUpRight size={16}/></Link></div></section>}
 <CustomerReviews productId={p.id} productName={p.name} designPreview={designPreview&&mode==="preview"}/><section className="related-products section-pad"><div className="section-heading"><div><p className="eyebrow">EXPLORE THE COLLECTION</p><h2>{p.category==="skincare"?"Complete your ritual.":"Explore more supplements."}</h2></div><Link href={`/collections/${p.category}`} className="under-link">{p.category==="skincare"?"Explore skincare":"Shop supplements"} <ArrowUpRight size={16}/></Link></div><ProductRail products={related} label={p.category}/></section>{!comingSoon&&<div className="sticky-purchase"><div><img src={p.image} alt=""/><span>{p.name}<small>{packageContents(p)}</small></span></div><button className="button button-dark" disabled={busy||!ready||!available} onClick={addSelection}>{!available?"Currently unavailable":busy?"Updating…":selectedPurchase==="subscription"?"Add subscription":"Add to bag"} <span>{money(price*quantity,currency)}</span></button></div>}</main>;
}
