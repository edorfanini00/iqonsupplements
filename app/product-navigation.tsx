"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Product } from "@/lib/catalog";

export function ProductLinks({products, activeId, onSelect}:{products:Product[];activeId?:string;onSelect?:()=>void}) {
  return <div className="direct-products">{products.map(p=><Link key={p.id} href={`/products/${p.id}`} className={`direct-product ${activeId===p.id?"is-current":""}`} aria-current={activeId===p.id?"page":undefined} onClick={onSelect}>
    <img src={p.image} alt="" width={64} height={80}/><span><strong>{p.name}</strong><small>{activeId===p.id?"You’re viewing":p.size}</small></span>
  </Link>)}</div>;
}

export function ProductSwitcher({product,products}:{product:Product;products:Product[]}) {
  const [open,setOpen]=useState(false);
  const collection=products.filter(p=>p.category===product.category);
  const index=collection.findIndex(p=>p.id===product.id);
  const previous=collection[(index-1+collection.length)%collection.length];
  const next=collection[(index+1)%collection.length];
  return <><nav className="product-switcher section-pad" aria-label="Browse the collection">
    <button onClick={()=>setOpen(true)}><LayoutGrid size={17}/>All {product.category}<span>{collection.length}</span></button>
    <div>{collection.length>1&&<><Link href={`/products/${previous.id}`} aria-label={`Previous product: ${previous.name}`}><ChevronLeft size={18}/><span>Previous</span></Link><span className="switcher-position">{index+1} / {collection.length}</span><Link href={`/products/${next.id}`} aria-label={`Next product: ${next.name}`}><span>Next</span><ChevronRight size={18}/></Link></>}</div>
  </nav><Sheet open={open} onOpenChange={setOpen}><SheetContent className="product-browse-sheet"><SheetTitle>Explore {product.category}</SheetTitle><SheetDescription>Choose a product to take a closer look.</SheetDescription><ProductLinks products={collection} activeId={product.id} onSelect={()=>setOpen(false)}/><Link className="button button-dark" href={`/collections/${product.category}`} onClick={()=>setOpen(false)}>View the full collection<ArrowRight size={17}/></Link></SheetContent></Sheet></>;
}

