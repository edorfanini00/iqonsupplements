import { notFound } from "next/navigation";
import { getStoreCatalog } from "@/lib/shopify.server";
import { ProductPage } from "../../shop-pages";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const catalog=await getStoreCatalog();const product=catalog.products.find(p=>p.id===slug);return {title:product?`${product.name} — IQON`:"IQON",description:product?.description};}
export default async function ProductRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const catalog=await getStoreCatalog();if(catalog.mode==="unavailable")return <main id="main" className="section-pad"><h1>We’ll be back shortly.</h1><p>The collection is temporarily unavailable. Please try again in a moment.</p></main>;const product=catalog.products.find(p=>p.id===slug);if(!product)notFound();return <ProductPage key={slug} product={product}/>;}
