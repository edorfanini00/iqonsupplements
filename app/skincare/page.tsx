import type { Metadata } from "next";
import { SkincareHome } from "./skincare-home";
import { publicPageMetadata } from "@/lib/seo.server";
export async function generateMetadata():Promise<Metadata>{return publicPageMetadata({path:"/skincare",title:"Skincare | IQON",description:"Explore the IQON skincare collection. Cleanser, serum and moisturizer, with a place for every step.",image:"/images/store/campaign-skincare.webp",requiresLiveCatalog:true,catalogCategory:"skincare"});}
export default function SkincarePage(){
 return <SkincareHome/>;
}
