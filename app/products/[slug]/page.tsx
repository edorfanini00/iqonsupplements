import { notFound } from "next/navigation";
import { findProduct } from "@/lib/catalog";
import { ProductPage } from "../../shop-pages";
export default async function ProductRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const product=findProduct(slug);if(!product)notFound();return <ProductPage key={slug} product={product}/>;}
