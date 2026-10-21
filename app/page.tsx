import { IQONSite } from "./site";
import { jsonLdScript, organizationJsonLd } from "@/lib/seo";
import { publicPageMetadata } from "@/lib/seo.server";
export async function generateMetadata(){return publicPageMetadata({path:"/",title:"IQON — Supplements & Skincare",description:"Explore the IQON collection. A considered approach to supplements, skincare and the everyday.",requiresLiveCatalog:true});}
export default function Home() {
 const designPreview=process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development";
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(organizationJsonLd())}}/><IQONSite designPreview={designPreview}/></>;
}
