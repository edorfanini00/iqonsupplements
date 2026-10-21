import { notFound } from "next/navigation";
import { getStoreCatalog } from "@/lib/shopify.server";
import { ProductPage } from "../../shop-pages";
import { isComingSoon } from "@/lib/commerce-policy";
import { breadcrumbJsonLd, isListedProduct, jsonLdScript, productJsonLd } from "@/lib/seo";
import { publicPageMetadata } from "@/lib/seo.server";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const catalog=await getStoreCatalog();const product=catalog.products.find(p=>p.id===slug);if(!product)return {title:"IQON"};
 // Only products Shopify returned are genuine pages; editorial placeholders and fallback states stay noindex.
 return publicPageMetadata({path:`/products/${product.id}`,title:`${product.name} — IQON`,description:product.description||undefined,image:product.image,imageAlt:product.images?.[0]?.alt,requiresLiveCatalog:true,eligible:isListedProduct(catalog,product)});}
export default async function ProductRoute({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const catalog=await getStoreCatalog();if(catalog.mode==="unavailable")return <main id="main" className="section-pad"><h1>We’ll be back shortly.</h1><p>The collection is temporarily unavailable. Please try again in a moment.</p></main>;const product=catalog.products.find(p=>p.id===slug);if(!product)notFound();const designPreview=catalog.mode==="preview"&&(process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development");const structured=isListedProduct(catalog,product)?[productJsonLd(product,isComingSoon(product)||!!product.pricePending),breadcrumbJsonLd([{name:"IQON",path:"/"},{name:product.category,path:`/collections/${product.category}`},{name:product.name,path:`/products/${product.id}`}])]:null;return <>{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(structured)}}/>}<ProductPage key={slug} product={product} designPreview={designPreview}/></>;}
