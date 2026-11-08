import { IQONSite } from "./site";
import { jsonLdScript, organizationJsonLd } from "@/lib/seo";
import { publicPageMetadata } from "@/lib/seo.server";
export async function generateMetadata(){return publicPageMetadata({path:"/",title:"IQON | Supplements & Skincare",description:"Explore IQON supplements by ingredient and format. Compare powders, capsules and gummies, and discover the coming soon skincare collection.",requiresLiveCatalog:true});}
export default function Home() {
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:jsonLdScript(organizationJsonLd())}}/><IQONSite/></>;
}
