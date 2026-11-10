import { notFound } from "next/navigation";
import { comingSoonSkincareProduct } from "@/lib/new-skincare";
import { getStoreCatalog } from "@/lib/shopify.server";
import { ProductPage } from "../../shop-pages";
import { isComingSoon } from "@/lib/commerce-policy";
import { breadcrumbJsonLd, isListedProduct, jsonLdScript, productJsonLd } from "@/lib/seo";
import { publicPageMetadata } from "@/lib/seo.server";

type ProductRouteProps = {params: Promise<{slug: string}>};
export async function generateMetadata({params}: ProductRouteProps) {
  const {slug} = await params;
  const catalog = await getStoreCatalog();
  const informational = comingSoonSkincareProduct(catalog, slug);
  const product = informational || catalog.products.find(p => p.id === slug);
  if (!product) return {title: "IQON"};
  // Only the explicit owner-approved informational pages are independent of Shopify.
  // Other editorial placeholders and fallback states retain their existing noindex gate.
  return publicPageMetadata({path: `/products/${product.id}`, title: `${product.name} | IQON`,
    description: product.description || undefined, image: product.image, imageAlt: product.images?.[0]?.alt,
    requiresLiveCatalog: !informational, eligible: !!informational || isListedProduct(catalog, product)});
}

export default async function ProductRoute({params}: ProductRouteProps) {
  const {slug} = await params;
  const catalog = await getStoreCatalog();
  const informational = comingSoonSkincareProduct(catalog, slug);
  if (catalog.mode === "unavailable" && !informational) return <main id="main" className="section-pad"><h1>We’ll be back shortly.</h1><p>The collection is temporarily unavailable. Please try again in a moment.</p></main>;
  const product = informational || catalog.products.find(p => p.id === slug);
  if (!product) notFound();
  const designPreview = !informational && catalog.mode === "preview" && (process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development");
  // Informational pages emit only their visible breadcrumb, never a Product/Offer.
  const structured = informational || isListedProduct(catalog, product) ? [
    informational ? null : productJsonLd(product, isComingSoon(product) || !!product.pricePending),
    breadcrumbJsonLd([{name: "IQON", path: "/"}, {name: product.category, path: `/collections/${product.category}`}, {name: product.name, path: `/products/${product.id}`}]),
  ].filter(item => item !== null) : null;
  return <>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdScript(structured)}}/>}<ProductPage key={slug} product={product} designPreview={designPreview}/></>;
}
