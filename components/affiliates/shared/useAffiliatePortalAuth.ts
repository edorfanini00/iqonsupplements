"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface AffiliatePortalUser {
  inviteUrl?: string;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "affiliate" | "shop_manager";
  promoCode: string;
}

type PortalVariant = "affiliate" | "admin" | "shop_manager";

function redirectForRole(
  role: AffiliatePortalUser["role"],
  variant: PortalVariant
): string | null {
  if (variant === "admin") {
    if (role === "shop_manager") return "/affiliates/shop-manager";
    if (role !== "admin") return "/affiliates/dashboard";
    return null;
  }
  if (variant === "shop_manager") {
    if (role === "admin") return "/affiliates/admin";
    if (role === "affiliate") return "/affiliates/dashboard";
    if (role !== "shop_manager") return "/affiliates/login";
    return null;
  }
  // affiliate variant
  if (role === "admin") return "/affiliates/admin";
  if (role === "shop_manager") return "/affiliates/shop-manager";
  if (role !== "affiliate") return "/affiliates/login";
  return null;
}

export function useAffiliatePortalAuth(variant: PortalVariant) {
  const router = useRouter();
  const [user, setUser] = useState<AffiliatePortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/affiliates/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/affiliates/login");
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        const portalUser = data.user ?? data.data?.user;
        if (!portalUser) {
          router.push("/affiliates/login");
          return;
        }

        const redirect = redirectForRole(portalUser.role, variant);
        if (redirect) {
          router.push(redirect);
          return;
        }

        setUser(portalUser);
      } catch {
        router.push("/affiliates/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, variant]);

  return { user, loading };
}
