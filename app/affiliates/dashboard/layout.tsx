"use client";

import { SidebarShell } from "@/components/affiliates/shared/SidebarShell";
import { AffiliateOnboarding } from "@/components/affiliates/AffiliateOnboarding";
import { useAffiliatePortalAuth } from "@/components/affiliates/shared/useAffiliatePortalAuth";
import { RecruitmentLink } from "@/components/affiliates/RecruitmentLink";

export default function AffiliateDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAffiliatePortalAuth("affiliate");

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
    <SidebarShell user={user} variant="affiliate">
      {user.inviteUrl && <RecruitmentLink inviteUrl={user.inviteUrl} />}
      {children}
      <AffiliateOnboarding />
    </SidebarShell>
  );
}
