"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useStore } from "./store-shell";
import { formatHref } from "@/lib/departments";
import type { Category } from "@/lib/catalog";

const formats=[
  {type:"Powder",title:"Powders",text:"Creatine, collagen and colostrum. Compare the ingredient, pack size and flavor.",id:"creatine-monohydrate"},
  {type:"Capsules",title:"Capsules",text:"Individual capsules in a bottle. Explore the range and compare the count in each pack.",id:"nmn"},
  {type:"Sachets",title:"Sachets",text:"Individually packed sachets, gathered in a resealable jar.",id:"colon-gentle-cleanse"},
  {type:"Gummies",title:"Gummies",text:"A chewable format. Discover the passion fruit expression in the collection.",id:"hair-skin-nails-gummies"},
];
const steps=[
  {type:"Cleanser",title:"Cleanse",text:"Start with a peptide-enriched cleanser, then choose the steps that fit your skin.",id:"anti-aging-cleanser-with-peptides"},
  {type:"Serum",title:"Treat",text:"Discover vitamin C for daily antioxidant care, or retinol for your evening routine.",id:"hydra-c-ferulic-serum"},
  {type:"Moisturizer",title:"Moisturize",text:"Meet Copper Peptide Restore Cream, a rich moisturizing finish.",id:"copper-peptide-restore-cream"},
];
export function CollectionGuide({department}:{department:Category}) {
  const {products,mode}=useStore();const skin=department==="skincare";
  const items=(skin?steps:formats).map(item=>({...item,product:products.find(p=>p.id===item.id)||products.find(p=>p.category===department&&p.type===item.type)})).filter(item=>!!item.product);
  if(mode!=="preview"||!items.length)return null;
  return <section id="formats" className={`collection-guide section-pad ${skin?"skin-guide":""}`}><div className="collection-guide-heading"><div><p className="eyebrow">{skin?"YOUR SKINCARE ROUTINE":"FIND YOUR FORMAT"}</p><h2>{skin?"Your skin. Your routine.":"Different formats. Your choice."}</h2></div><p>{skin?"Seven focused formulas. Start with the essentials and choose your treatment steps.":"Start with the product you’re looking for. Then get to know its format, size and details."}</p></div><div className="collection-guide-grid">{items.map((item,i)=><article key={item.type}><Link href={skin?`/products/${item.product!.id}`:formatHref(department,item.type)} className="collection-guide-image"><span>{String(i+1).padStart(2,"0")} / {item.title}</span><img src={item.product!.image} alt={item.product!.name} loading="lazy" width={360} height={440}/></Link><h3>{item.title}</h3><p>{item.text}</p><Link className="under-link" href={skin?`/products/${item.product!.id}`:formatHref(department,item.type)}>{skin?item.product!.name:`Explore ${item.title.toLowerCase()}`}<ArrowUpRight size={15}/></Link></article>)}</div>{mode==="preview"&&<p className="collection-guide-note">{skin?"Choose your treatment steps individually; a routine does not need every active at once.":"Serving sizes, ingredients and directions will be published with the final product labels before orders open."}</p>}</section>;
}
