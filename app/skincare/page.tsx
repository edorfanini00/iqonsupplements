import type { Metadata } from "next";
import { SkincareHome } from "./skincare-home";
export const metadata:Metadata={title:"Skincare | IQON",description:"Explore the IQON skincare collection. Cleanser, serum and moisturizer, with a place for every step."};
export default function SkincarePage(){return <SkincareHome/>;}
