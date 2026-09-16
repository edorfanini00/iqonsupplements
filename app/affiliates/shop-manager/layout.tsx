"use client";

import { SidebarShell } from "@/components/affiliates/shared/SidebarShell";
import { useAffiliatePortalAuth } from "@/components/affiliates/shared/useAffiliatePortalAuth";


export default function ShopManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAffiliatePortalAuth("shop_manager");

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#f2f4f5] flex items-center justify-center">
        <div className="animate-pulse text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a]">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <>
      <SidebarShell user={user} variant="shop_manager">
        {children}
      </SidebarShell>
    </>
  );
}
