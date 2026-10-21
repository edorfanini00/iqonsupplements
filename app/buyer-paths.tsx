"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useStore } from "./store-shell";
import { formatLabel } from "@/lib/departments";
import { productGuides, sectionFact, sectionProducts } from "@/lib/buyer-paths";
import type { JournalArticle } from "@/lib/journal";
import type { Product } from "@/lib/catalog";

/** A guide section's orderable products. Renders nothing in preview, during an outage or when none are available. */
export function GuideSectionProducts({section}:{section:JournalArticle["sections"][number]}) {
 const {products,mode}=useStore();const list=sectionProducts(section,products,mode);
 if(!list.length)return null;
 return <aside className="guide-products" aria-label={section.format?`${formatLabel(section.format)} in the IQON collection`:"In the IQON collection"}><p className="eyebrow">{section.format?`${formatLabel(section.format).toUpperCase()} IN THE COLLECTION`:"IN THE COLLECTION"}</p><ul>{list.map(p=>{const fact=sectionFact(section,p);return <li key={p.id}><Link href={`/products/${p.id}`}><span>{p.name}{fact&&<small>{fact}</small>}</span><ArrowUpRight size={16}/></Link></li>;})}</ul></aside>;
}

/** Reciprocal links from a supplement page to the guides that discuss it or its format. */
export function ProductGuides({product}:{product:Product}) {
 const guides=productGuides(product);
 if(!guides.length)return null;
 return <aside className="product-guides" aria-label="Related guides"><p className="eyebrow">GUIDES</p>{guides.map(g=><Link key={g.slug} className="under-link" href={`/journal/${g.slug}`}>{g.title.replace(/\.$/,"")}<ArrowUpRight size={15}/></Link>)}</aside>;
}
