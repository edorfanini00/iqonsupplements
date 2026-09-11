"use client";
import {useRef} from "react";
import {ArrowLeft,ArrowRight} from "lucide-react";
import type {Product} from "@/lib/catalog";
import {ProductCard} from "./store-shell";
export function ProductRail({products,label="supplements"}:{products:Product[];label?:string}) {
  const rail=useRef<HTMLDivElement>(null);
  const move=(direction:number)=>{const e=rail.current;if(e)e.scrollBy({left:direction*e.clientWidth*.85,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
  return <div className="shopping-rail"><div ref={rail} className={`product-rail ${products.length===3?"three-product-rail":products.length===2?"two-product-rail":""}`} tabIndex={0} role="region" aria-label={`Browse all ${label}`}>{products.map(p=><ProductCard key={p.id} product={p}/>)}</div><div className="rail-controls"><span>{products.length} {label}<span className="rail-mobile-hint"> · Swipe to explore</span></span><div><button aria-label={`Previous ${label}`} onClick={()=>move(-1)}><ArrowLeft size={19}/></button><button aria-label={`More ${label}`} onClick={()=>move(1)}><ArrowRight size={19}/></button></div></div></div>;
}
