import type { Metadata } from "next";
import "./globals.css";
import { StoreShell } from "./store-shell";
export const metadata: Metadata = {
  title: "IQON — Supplements & Skincare",
  description: "Explore the IQON collection. A considered approach to supplements, skincare and the everyday.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><StoreShell>{children}</StoreShell></body></html>;
}
