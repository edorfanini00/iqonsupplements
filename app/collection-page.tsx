"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChevronRight, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard, useStore } from "./store-shell";
import { CollectionGuide } from "./collection-guide";
import { HumanStory, JournalPreview } from "./editorial";
import { departmentHome, formatLabel, formatOrder, formatSlug } from "@/lib/departments";
import type { Category } from "@/lib/catalog";

export function CollectionPage({category,initialFormat="all",initialSort="featured"}:{category:Category|"all";initialFormat?:string;initialSort?:string}) {
  const {products,mode,department}=useStore();
  const router=useRouter();
  const skin=category==="skincare";
  const base=products.filter(p=>category==="all"||p.category===category);
  const types=[...new Set(base.map(p=>p.type))].sort((a,b)=>formatOrder.indexOf(a)-formatOrder.indexOf(b));
  const filter=types.find(type=>formatSlug(type)===initialFormat)||"all";
  const sort=["featured","low","high","name"].includes(initialSort)?initialSort:"featured";
  const visible=base.filter(p=>filter==="all"||p.type===filter).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="low"||sort==="high"?(a.pricePending!==b.pricePending?Number(!!a.pricePending)-Number(!!b.pricePending):sort==="low"?a.price-b.price:b.price-a.price):Number(a.number)-Number(b.number));
  const href=(type:string,order=sort)=>{const params=new URLSearchParams();if(type!=="all")params.set("format",formatSlug(type));if(order!=="featured")params.set("sort",order);return `/collections/${category}${params.size?`?${params}`:""}`;};
  return <main id="main" className={`collection-store ${skin?"skin-catalog":"supplement-catalog"}`}>
    <section className="collection-heading section-pad"><nav className="breadcrumbs" aria-label="Breadcrumb"><Link href={departmentHome(department)}>IQON</Link><ChevronRight size={12}/><span>{category==="all"?"All IQON products":category}</span></nav><div><h1>{filter==="all"?(category==="all"?"The IQON collection.":skin?"Skincare, considered.":"Your daily essentials."):formatLabel(filter)}</h1><p>{category==="all"?"Supplements and skincare. The complete IQON collection.":skin?"Cleanse, treat, moisturize. Explore the skincare collection.":"Explore supplements by ingredient, product or format."}</p></div></section>
    <div className="collection-detail-line section-pad"><span>{category==="all"?"THE IQON COLLECTION":`IQON ${category.toUpperCase()}`}</span><span>{skin?"THREE STEPS. YOUR OWN ROUTINE.":"POWDERS · CAPSULES · SACHETS · GUMMIES"}</span><span>{String(base.length).padStart(2,"0")} PRODUCTS</span></div>
    <section className="collection-shop-layout section-pad" aria-label="Shop products">
      <aside className="collection-side"><nav className="collection-primary-links" aria-label="Collection"><Link className={filter==="all"?"is-current":""} aria-current={filter==="all"?"page":undefined} href={href("all")}>Shop all<small>{base.length}</small></Link>{category==="all"?<><Link href="/collections/supplements">Supplements<ArrowUpRight size={16}/></Link><Link href="/collections/skincare">Skincare<ArrowUpRight size={16}/></Link></>:<Link href="#formats">{skin?"The skincare routine":"Compare formats"}<ArrowUpRight size={16}/></Link>}</nav><nav className="collection-format-links" aria-label={skin?"Shop by category":"Shop by format"}><p className="eyebrow">{skin?"CATEGORY":"FORMAT"}</p>{types.map(type=><Link key={type} href={href(type)} className={filter===type?"is-current":""} aria-current={filter===type?"page":undefined}>{formatLabel(type)}<small>{base.filter(p=>p.type===type).length}</small></Link>)}</nav><div className="collection-side-foot"><span className="eyebrow">ALSO FROM IQON</span><Link href={departmentHome(skin?"supplements":"skincare")}>{skin?"Discover supplements":"Discover skincare"}<ArrowUpRight size={16}/></Link><Link href="/approach">Our approach<ArrowUpRight size={16}/></Link></div></aside>
      <div className="collection-results"><div className="collection-results-bar"><div aria-live="polite"><span>{visible.length} {visible.length===1?"product":"products"}</span>{filter!=="all"&&<Link className="active-format" href={href("all")} aria-label={`Clear ${formatLabel(filter)} filter`}>{formatLabel(filter)}<X size={12}/></Link>}</div><Select value={sort} onValueChange={value=>router.push(href(filter,value),{scroll:false})}><SelectTrigger aria-label="Sort products"><SelectValue>{({featured:"Featured",name:"Name: A to Z",low:"Price: low to high",high:"Price: high to low"} as Record<string,string>)[sort]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="featured">Featured</SelectItem><SelectItem value="name">Name: A to Z</SelectItem>{base.some(p=>!p.pricePending)&&<><SelectItem value="low">Price: low to high</SelectItem><SelectItem value="high">Price: high to low</SelectItem></>}</SelectContent></Select></div>
        {skin&&filter==="all"&&<div className="collection-skin-intro"><img src="/images/store/campaign-skincare.webp" alt="The IQON skincare collection, silver details and serum texture" width={1920} height={1080}/><div><p className="eyebrow">THE SKINCARE COLLECTION</p><h2>A place for<br/>every step.</h2><Link className="under-link" href="#formats">Meet your routine<ArrowUpRight size={16}/></Link></div></div>}
        <div className="product-grid collection-products">{visible.map(p=><ProductCard key={p.id} product={p}/>)}{!visible.length&&<div className="collection-no-products"><h2>{mode==="unavailable"?"We’ll be back shortly.":"More to come."}</h2><p>{mode==="unavailable"?"The collection is temporarily unavailable. Please try again shortly.":"This collection is coming soon."}</p><Link href="/collections/all" className="under-link">Explore IQON<ArrowRight size={16}/></Link></div>}</div>
      </div>
    </section>
    <HumanStory skincare={skin} compact/><CollectionGuide department={skin?"skincare":"supplements"}/><JournalPreview skincare={skin}/>
    <section className="department-discovery"><img src={skin?"/images/supplements/20_group_all_row.webp":"/images/store/campaign-skincare.webp"} alt={skin?"The IQON supplement collection":"The IQON skincare collection"} width={1920} height={1080} loading="lazy"/><div><p className="eyebrow">ALSO FROM IQON</p><h2>{skin?<>Meet your<br/>daily essentials.</>:<>A new chapter<br/>for your skin.</>}</h2><p>{skin?"Explore creatine, collagen and the rest of our supplement collection.":"Get to know the cleanser, serum and cream in the IQON skincare collection."}</p><Link className="button button-dark" href={departmentHome(skin?"supplements":"skincare")}>Discover {skin?"supplements":"skincare"}<ArrowRight size={17}/></Link></div></section>
  </main>;
}
