import type { Metadata } from "next";
import "./account.css";
import { AccountShell } from "./account-client";

export const metadata: Metadata = {title: "My Account — IQON Body", robots: {index: false, follow: false}};
export default function AccountLayout({children}: {children: React.ReactNode}) {
  return <AccountShell>{children}</AccountShell>;
}
