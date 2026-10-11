import type { Metadata } from "next";
import "./globals.css";
import "./experience.css";
import "./refinement.css";
import "./commerce.css";
import "./product-experience.css";
import "./product-story-v4.css";
import "./skincare-product-story.css";
import "./supplement-product-story.css";
import "./privacy.css";
import { StoreShell } from "./store-shell";
import { getStoreCatalog } from "@/lib/shopify.server";
import { initialPrivacySnapshot, privacyLinks } from "@/lib/privacy.server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "IQON — Supplements & Skincare",
  description: "Explore the IQON collection. A considered approach to supplements, skincare and the everyday.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [catalog,privacy]=await Promise.all([getStoreCatalog(),initialPrivacySnapshot()]);
  return <html lang="en"><head>{catalog.mode!=="live"&&<meta name="codex-preview" content="development"/>}</head><body><StoreShell catalog={catalog} privacy={privacy} privacyLinks={privacyLinks()}>{children}</StoreShell></body></html>;
}
