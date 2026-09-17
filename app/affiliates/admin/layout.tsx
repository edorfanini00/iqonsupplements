"use client";
import { CommandRecovery } from "@/components/affiliates/shared/CommandRecovery";

import { SidebarShell } from "@/components/affiliates/shared/SidebarShell";
import { useAffiliatePortalAuth } from "@/components/affiliates/shared/useAffiliatePortalAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAffiliatePortalAuth("admin");

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
    <SidebarShell user={user} variant="admin">
      <CommandRecovery />
      {children}
    </SidebarShell>
  );
}
