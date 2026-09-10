"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard, useStore } from "./store-shell";
import { HumanStory } from "./editorial";
import { formatSlug, formatLabel } from "@/lib/departments";
import type { Category } from "@/lib/catalog";

export function CollectionPage({category,initialFormat="all",initialSort="featured"}:{category:Category|"all";initialFormat?:string;initialSort?:string}) {
 const {products,mode}=useStore();const router=useRouter();const [query,setQuery]=useState("");const skin=category==="skincare";
 const base=products.filter(p=>category==="all"||p.category===category);const filter=base.find(p=>formatSlug(p.type)===initialFormat)?.type||"all";
 const sort=["featured","low","high","name"].includes(initialSort)?initialSort:"featured";
 const visible=base.filter(p=>(filter==="all"||p.type===filter)&&`${p.name} ${p.descriptor}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="low"||sort==="high"?(a.pricePending!==b.pricePending?Number(!!a.pricePending)-Number(!!b.pricePending):sort==="low"?a.price-b.price:b.price-a.price):Number(a.number)-Number(b.number));
 const href=(order=sort,keepFilter=true)=>{const params=new URLSearchParams();if(keepFilter&&filter!=="all")params.set("format",formatSlug(filter));if(order!=="featured")params.set("sort",order);return `/collections/${category}${params.size?`?${params}`:""}`;};
 return <main id="main" className="collection-store direct-catalog">
  <header className="catalog-heading section-pad"><p className="eyebrow">THE IQON COLLECTION</p><h1>{category==="all"?"All IQON products.":skin?"Skincare.":"All supplements."}</h1><p>{skin?"Cleanse. Treat. Moisturize.":"Find your everyday essentials."}</p></header>
  <section className="catalog-shopping section-pad" aria-label="Shop products"><div className="catalog-toolbar"><label className="catalog-search"><Search size={20}/><input type="search" aria-label="Find a product" placeholder="Find a product" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear product search" onClick={()=>setQuery("")}><X size={18}/></button>}</label><div className="catalog-count" aria-live="polite">{visible.length} products</div><Select value={sort} onValueChange={v=>router.push(href(v),{scroll:false})}><SelectTrigger aria-label="Sort products"><SelectValue>{({featured:"Featured",name:"Name: A to Z",low:"Price: low to high",high:"Price: high to low"} as Record<string,string>)[sort]}</SelectValue></SelectTrigger><SelectContent><SelectItem value="featured">Featured</SelectItem><SelectItem value="name">Name: A to Z</SelectItem>{base.some(p=>!p.pricePending)&&<><SelectItem value="low">Price: low to high</SelectItem><SelectItem value="high">Price: high to low</SelectItem></>}</SelectContent></Select></div>
  {filter!=="all"&&<Link className="active-format legacy-filter" href={href(sort,false)}>Showing {formatLabel(filter)} · Show all products<X size={16}/></Link>}
  {category==="all"&&<nav className="catalog-departments" aria-label="Product collections"><Link href="/collections/supplements">Supplements<ArrowRight size={16}/></Link><Link href="/collections/skincare">Skincare<ArrowRight size={16}/></Link></nav>}
  <div className="product-grid direct-catalog-grid">{visible.map(p=><ProductCard key={p.id} product={p}/>)}</div>
  {!visible.length&&<div className="catalog-empty"><h2>{mode==="unavailable"?"We’ll be back shortly.":query?"No products found.":"More to come."}</h2><p>{mode==="unavailable"?"Please try again shortly.":query?"Try another product name or clear your search.":"This collection is coming soon."}</p>{query&&<button className="button button-dark" onClick={()=>setQuery("")}>Show all products</button>}</div>}
  </section><HumanStory skincare={skin} compact/>
 </main>;
}
