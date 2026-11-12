import { notFound } from "next/navigation";
import { CollectionPage } from "../../shop-pages";
import { collectionCategory } from "@/lib/seo";
import { publicPageMetadata } from "@/lib/seo.server";
import { getStoreCatalog } from "@/lib/shopify.server";
import { collectionDescription, skincareAvailability } from "@/lib/skincare-copy";
const collectionMetadata:Record<string,{title:string;description:string}>={all:{title:"All products | IQON",description:collectionDescription("all","held")},supplements:{title:"Supplements | IQON",description:"Shop IQON supplements, each with its format, contents and current price."},skincare:{title:"Skincare products | IQON",description:collectionDescription("skincare","held")}};
// Filter and sort parameters canonicalize to the clean collection URL.
// Skincare wording comes from the same request-scoped catalog (React cache) the page renders, so it never claims
// more than the page shows; preview, outage or a held catalog keep the "coming soon" description.
export async function generateMetadata({params}:{params:Promise<{category:string}>}){const {category}=await params;const page=collectionMetadata[category];if(!page)return {};const catalog=await getStoreCatalog();const description=category==="supplements"?page.description:collectionDescription(category as "all"|"skincare",skincareAvailability(catalog.products,catalog.mode));return publicPageMetadata({...page,description,path:`/collections/${category}`,requiresLiveCatalog:category!=="skincare",catalogCategory:collectionCategory(category)});}
export default async function CollectionRoute({params,searchParams}:{params:Promise<{category:string}>;searchParams:Promise<{format?:string;sort?:string}>}){const {category}=await params;const query=await searchParams;if(!["all","supplements","skincare"].includes(category))notFound();return <CollectionPage category={category as "all"|"supplements"|"skincare"} initialFormat={typeof query.format==="string"?query.format:"all"} initialSort={typeof query.sort==="string"?query.sort:"featured"}/>;}
