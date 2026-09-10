import type { Metadata } from "next";
import "./globals.css";
import "./experience.css";
import "./refinement.css";
import { StoreShell } from "./store-shell";
import { getStoreCatalog } from "@/lib/shopify.server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "IQON — Supplements & Skincare",
  description: "Explore the IQON collection. A considered approach to supplements, skincare and the everyday.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const catalog=await getStoreCatalog();
  return <html lang="en"><head>{catalog.mode!=="live"&&<meta name="codex-preview" content="development"/>}</head><body><StoreShell catalog={catalog}>{children}</StoreShell></body></html>;
}
