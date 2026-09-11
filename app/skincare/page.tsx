import type { Metadata } from "next";
import { SkincareHome } from "./skincare-home";
export const metadata:Metadata={title:"Skincare | IQON",description:"Explore the IQON skincare collection. Cleanser, serum and moisturizer, with a place for every step."};
export default function SkincarePage(){
 // Keep clearly marked layout samples on development and Vercel draft previews only.
 const designPreview=process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development";
 return <SkincareHome designPreview={designPreview}/>;
}
