import type { Metadata } from "next";
import { STOREFRONT_ORIGIN } from "@/lib/storefront";
import { IQONSite } from "./site";
export const metadata: Metadata = { alternates: { canonical: STOREFRONT_ORIGIN } };

export default function Home() {
 const designPreview=process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development";
 return <IQONSite designPreview={designPreview}/>;
}
