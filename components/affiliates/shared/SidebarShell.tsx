"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, Fragment } from "react";
import { usePollingInterval } from "@/components/affiliates/shared/usePollingInterval";
import {
  LayoutDashboard,
  Users,
  Wallet,
  BarChart3,
  Activity,
  ShoppingBag,
  Menu,
  X,
  LogOut,
  Inbox,
  UserSquare,
  CreditCard,
  Network,
  Mail,
  MessageSquare,
  Settings,
  Repeat,
  GraduationCap,
  StickyNote,
  Contact,
  Calculator,
  Trophy,
  Music2,
  Smartphone,
} from "lucide-react";

type BadgeKey =
  | "pendingRequests"
  | "unreadMessages"
  | "unreadAffiliateMessages"
  | "pendingPayouts";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional badge value, e.g. "3" for 3 pending requests */
  badgeKey?: BadgeKey;
  /** Shows a dismissible "Start here" nudge until the page is first visited. */
  startHere?: boolean;
}

const LEARN_VISITED_KEY = "iqon_supplements_affiliate_learn_visited";

const adminNav: NavItem[] = [
  { href:"/affiliates/admin/integrations",label:"Connections",icon:Settings },
  { href: "/affiliates/admin", label: "Overview", icon: LayoutDashboard },
  {
    href: "/affiliates/admin/requests",
    label: "Requests",
    icon: Inbox,
    badgeKey: "pendingRequests",
  },
  { href: "/affiliates/admin/affiliates", label: "Affiliates", icon: Users },
  { href: "/affiliates/admin/rankings", label: "Rankings", icon: Trophy },
  { href: "/affiliates/admin/tiktok", label: "TikTok bonus", icon: Music2 },
  { href: "/affiliates/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/affiliates/admin/customers", label: "Customers", icon: Contact },
  { href: "/affiliates/admin/subscriptions", label: "Subscriptions", icon: Repeat },
  { href: "/affiliates/admin/app", label: "App", icon: Smartphone },
  {
    href: "/affiliates/admin/affiliate-messages",
    label: "Affiliate chat",
    icon: MessageSquare,
    badgeKey: "unreadAffiliateMessages",
  },
  {
    href: "/affiliates/admin/messages",
    label: "Contact inbox",
    icon: Mail,
    badgeKey: "unreadMessages",
  },
  { href: "/affiliates/admin/notes", label: "Notes", icon: StickyNote },
  { href: "/affiliates/admin/accounting", label: "Accounting", icon: Calculator },
  {
    href: "/affiliates/admin/payouts",
    label: "Payouts",
    icon: Wallet,
    badgeKey: "pendingPayouts",
  },
  { href: "/affiliates/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/affiliates/admin/activity", label: "Activity", icon: Activity },
];

const shopManagerNav: NavItem[] = [
  { href: "/affiliates/shop-manager/orders", label: "Orders", icon: ShoppingBag },
];

const affiliateNav: NavItem[] = [
  { href: "/affiliates/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/affiliates/dashboard/learn",
    label: "Learn",
    icon: GraduationCap,
    startHere: true,
  },
  { href: "/affiliates/dashboard/clients", label: "Clients", icon: UserSquare },
  { href: "/affiliates/dashboard/network", label: "Network", icon: Network },
  { href: "/affiliates/dashboard/orders", label: "Orders", icon: Activity },
  {
    href: "/affiliates/dashboard/messages",
    label: "Messages",
    icon: MessageSquare,
    badgeKey: "unreadMessages",
  },
  { href: "/affiliates/dashboard/payouts", label: "Payouts", icon: Wallet },
  { href: "/affiliates/dashboard/payment", label: "Payment Info", icon: CreditCard },
  { href: "/affiliates/dashboard/settings", label: "Settings", icon: Settings },
];

interface User {
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "affiliate" | "shop_manager";
  promoCode: string;
}

interface Props {
  user: User;
  variant: "admin" | "affiliate" | "shop_manager";
  children: React.ReactNode;
}

export function SidebarShell({ user, variant, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({
    pendingRequests: 0,
    unreadMessages: 0,
    unreadAffiliateMessages: 0,
    pendingPayouts: 0,
  });
  // Polling only runs while the session is valid. If a badge request comes back
  // unauthorized (session expired / logged out), we stop the timer so a stale
  // tab never keeps hitting the API.
  const [loggedIn, setLoggedIn] = useState(true);
  // "Start here" nudge on Learn: hidden until we've read localStorage, and
  // dismissed permanently once the affiliate opens the Learn section.
  const [learnVisited, setLearnVisited] = useState(true);
  const items =
    variant === "admin"
      ? adminNav
      : variant === "shop_manager"
        ? shopManagerNav
        : affiliateNav;
  const portalLabel =
    variant === "admin"
      ? "Admin"
      : variant === "shop_manager"
        ? "Fulfillment"
        : "Affiliate";
  const portalTitle =
    variant === "admin"
      ? "Management Portal"
      : variant === "shop_manager"
        ? "Fulfillment Portal"
        : "Affiliate Portal";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setLearnVisited(localStorage.getItem(LEARN_VISITED_KEY) === "1");
    } catch {
      setLearnVisited(false);
    }
  }, []);

  useEffect(() => {
    if (
      variant === "affiliate" &&
      pathname.startsWith("/affiliates/dashboard/learn")
    ) {
      try {
        localStorage.setItem(LEARN_VISITED_KEY, "1");
      } catch {
        // ignore storage failures
      }
      setLearnVisited(true);
    }
  }, [pathname, variant]);

  // Badge counts come from a single consolidated endpoint per role. Admins read
  // all three counts from /admin/badges in one query; affiliates read one unread
  // count. Polling is visibility-gated (a backgrounded tab issues zero queries)
  // and stops entirely once the session is no longer valid.
  const load = useCallback(async () => {
    if (variant === "shop_manager") return;
    try {
      const res = await fetch(
        variant === "admin"
          ? "/api/affiliates/admin/badges"
          : "/api/affiliates/messages/unread",
        { credentials: "include" }
      );
      if (res.status === 401 || res.status === 403) {
        setLoggedIn(false);
        return;
      }
      const data = res.ok ? await res.json() : {};
      if (variant === "admin") {
        setBadges({
          pendingRequests: data.pendingRequests ?? 0,
          unreadMessages: data.unreadMessages ?? 0,
          unreadAffiliateMessages: data.unreadAffiliateMessages ?? 0,
          pendingPayouts: data.pendingPayouts ?? 0,
        });
      } else {
        setBadges((prev) => ({
          ...prev,
          unreadMessages: data.unreadCount ?? 0,
        }));
      }
    } catch {
      // silent
    }
  }, [variant]);

  usePollingInterval(load, 60000, loggedIn);

  // Refresh badges immediately after in-app navigation (e.g. clearing a request
  // queue), without waiting for the next poll tick.
  useEffect(() => {
    if (
      loggedIn &&
      typeof document !== "undefined" &&
      document.visibilityState === "visible"
    ) {
      load();
    }
  }, [pathname, load, loggedIn]);

  async function handleLogout() {
    await fetch("/api/affiliates/logout", { method: "POST", credentials: "include" });
    router.push("/affiliates");
  }

  return (
    <div className="relative min-h-screen bg-[#f2f4f5] text-[#20282c] overflow-hidden">
      {/* Ambient orbs */}
      <div
        className="dashboard-orb"
        style={{
          background: "rgba(30, 30, 30, 0.18)",
          width: 600,
          height: 600,
          top: -200,
          left: -140,
        }}
      />
      <div
        className="dashboard-orb"
        style={{
          background: "rgba(90, 107, 101, 0.2)",
          width: 540,
          height: 540,
          top: 320,
          right: -180,
          animationDelay: "-14s",
        }}
      />

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 glass-surface-strong border-b border-[#242526]/8">
        <div className="flex items-center justify-between px-5 py-3">
          <Link href="/affiliates" className="flex items-center gap-2">
            <img className="portal-logo" src="/images/brand/iqon-logo.png" alt="IQON Supplements" />
            {variant !== "shop_manager" && (
              <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] border-l border-[#242526]/15 pl-2 ml-1">
                {portalLabel}
              </span>
            )}
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-full hover:bg-[#242526]/5"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 z-40 w-72 h-screen flex-shrink-0 transition-transform duration-300 lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="m-3 lg:m-4 lg:mr-0 h-[calc(100vh-1.5rem)] lg:h-[calc(100vh-2rem)] glass-surface-strong rounded-lg flex flex-col overflow-hidden">
            <div className="px-6 pt-7 pb-6">
              <Link href="/" className="flex items-center gap-2.5 mb-1">
                <img className="portal-logo" src="/images/brand/iqon-logo.png" alt="IQON Supplements" />
              </Link>
              {variant !== "shop_manager" && (
                <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-3">
                  {portalTitle}
                </p>
              )}
            </div>

            <nav className="flex-1 px-3 overflow-y-auto">
              <ul className="space-y-1">
                {items.map((item) => {
                  const active =
                    item.href === pathname ||
                    (item.href !==
                      `/affiliates/${
                        variant === "admin"
                          ? "admin"
                          : variant === "shop_manager"
                            ? "shop-manager"
                            : "dashboard"
                      }` &&
                      pathname.startsWith(item.href));
                  const badgeValue =
                    item.badgeKey ? badges[item.badgeKey] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                          active
                            ? "bg-[#242526] text-white"
                            : "text-[#20282c] hover:bg-[#242526]/5"
                        }`}
                      >
                        <item.icon
                          className={`h-4 w-4 ${
                            active ? "text-white" : "text-[#64717a]"
                          }`}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.startHere && !learnVisited && !active && (
                          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] font-sans px-1.5 py-0.5 rounded-full leading-none bg-emerald-500 text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            Start here
                          </span>
                        )}
                        {badgeValue > 0 && (
                          <span
                            className={`text-[10px] font-sans px-1.5 py-0.5 rounded-full leading-none ${
                              active
                                ? "bg-white/15 text-white"
                                : "bg-[#242526] text-white"
                            }`}
                          >
                            {badgeValue}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* User card */}
            <div className="m-3 p-4 rounded-lg bg-[#242526]/4 border border-[#242526]/8">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#242526] text-white flex items-center justify-center text-xs font-sans font-medium">
                  {user.firstName.charAt(0).toUpperCase()}
                  {user.lastName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-sans text-[#64717a] mt-0.5 truncate">
                    {user.role === "shop_manager" ? "CEO" : user.role}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-full hover:bg-[#242526]/5"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5 text-[#64717a]" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Backdrop on mobile */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-[#20282c]/40 backdrop-blur-sm z-30"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Content */}
        <main className="flex-1 min-w-0 px-5 sm:px-6 lg:px-8 py-6 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
