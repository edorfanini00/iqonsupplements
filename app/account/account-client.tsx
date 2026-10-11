"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, LockKeyhole, LogOut } from "lucide-react";
import type { ApiError, Money, SessionState } from "@/lib/customer-account/types";

// Client side of the customer account BFF. Tokens never reach this file: it only sees
// the JSON view models from /api/account/* and a per-session CSRF token.

type Account = {session: SessionState | null; reloadSession: () => void; csrf: string};
const AccountContext = createContext<Account | null>(null);
export function useAccount() { const value = useContext(AccountContext); if (!value) throw new Error("Account context missing"); return value; }

export class AccountRequestError extends Error {
  constructor(public status: number, public body: Partial<ApiError>) { super(body.message || "Something went wrong. Please try again."); }
}

const NAV = [
  {href: "/account", label: "Overview"},
  {href: "/account/orders", label: "Orders"},
  {href: "/account/subscriptions", label: "Subscriptions"},
  {href: "/account/addresses", label: "Addresses"},
  {href: "/account/profile", label: "Profile"},
  {href: "/account/privacy", label: "Privacy"},
];

const PUBLIC_PATHS = new Set(["/account/signed-out", "/account/privacy"]);

const SIGN_IN_NOTICE: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again whenever you’re ready.",
  expired: "That sign-in link expired. Please start again.",
  failed: "We couldn’t complete your sign-in. Please try again.",
  unavailable: "Sign-in is temporarily unavailable. Please try again in a moment.",
};

async function readSession(): Promise<SessionState> {
  try {
    const response = await fetch("/api/account/session", {cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000)});
    const data = await response.json() as SessionState;
    return data.status ? data : {status: "unavailable"};
  } catch { return {status: "unavailable"}; }
}

export function AccountShell({children}: {children: ReactNode}) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionState | null>(null);
  const [sessionLoads, setSessionLoads] = useState(0);
  useEffect(() => {
    let live = true;
    readSession().then(next => { if (live) setSession(next); });
    return () => { live = false; };
  }, [sessionLoads]);
  const reloadSession = useCallback(() => { setSession(null); setSessionLoads(n => n + 1); }, []);
  const csrf = session?.status === "signed_in" ? session.csrf : "";
  const value: Account = {session, reloadSession, csrf};

  // Public pages: the sign-out landing and the privacy page, which guests reach from the footer.
  // They never wait for or require a session; signed-in customers still see the account menu.
  if (PUBLIC_PATHS.has(pathname) && session?.status !== "signed_in") return <AccountContext.Provider value={value}><main id="main" className="account-page section-pad"><div className="account-public">{children}</div></main></AccountContext.Provider>;
  return <AccountContext.Provider value={value}>
    <main id="main" className="account-page section-pad">
      {session === null ? <div className="account-frame account-frame-loading" aria-busy="true"><p className="account-status" role="status">Loading My Account…</p></div>
        : session.status === "signed_in" ? <div className="account-frame">
          <aside className="account-sidebar">
            <p className="eyebrow">MY ACCOUNT</p>
            <p className="account-hello">{session.firstName ? `Hello, ${session.firstName}.` : "Hello."}</p>
            <nav className="account-nav" aria-label="Account">
              {NAV.map(item => {
                const active = item.href === "/account" ? pathname === "/account" : pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={active ? "is-active" : ""}>{item.label}</Link>;
              })}
            </nav>
            <form method="post" action="/account/logout" className="account-signout account-signout-side"><button type="submit"><LogOut size={15} strokeWidth={1.5}/>Sign out</button></form>
          </aside>
          <div className="account-content">{children}<form method="post" action="/account/logout" className="account-signout account-signout-end"><button type="submit"><LogOut size={15} strokeWidth={1.5}/>Sign out</button></form></div>
        </div>
        : <SignedOutState state={session} returnTo={pathname}/>}
    </main>
  </AccountContext.Provider>;
}

function SignedOutState({state, returnTo}: {state: SessionState; returnTo: string}) {
  // Only rendered after the client has read the session, so window is available here.
  const [notice] = useState(() => SIGN_IN_NOTICE[new URL(window.location.href).searchParams.get("signin") || ""] || "");
  useEffect(() => {
    // Drop the reason from the address bar so a refresh doesn't repeat it.
    const url = new URL(window.location.href);
    if (url.searchParams.has("signin")) { url.searchParams.delete("signin"); window.history.replaceState(null, "", url.pathname + url.search); }
  }, []);
  if (state.status === "not_configured") return <section className="account-gate">
    <div className="account-gate-copy"><p className="eyebrow">MY ACCOUNT</p><h1>Accounts are opening soon.</h1><p>You’ll be able to sign in here to see your orders, subscriptions and saved addresses. Until then, your order confirmation email has a link to your order status.</p><Link className="button button-dark" href="/help">Questions & care<ArrowRight size={17}/></Link></div>
  </section>;
  if (state.status === "unavailable") return <section className="account-gate">
    <div className="account-gate-copy"><p className="eyebrow">MY ACCOUNT</p><h1>We can’t reach your account right now.</h1><p>Please try again in a moment.</p><button className="button button-dark" onClick={() => window.location.reload()}>Try again<ArrowRight size={17}/></button></div>
  </section>;
  return <section className="account-gate">
    <div className="account-gate-copy">
      <p className="eyebrow">MY ACCOUNT</p>
      <h1>Sign in or create your account.</h1>
      <p>Enter your email and we’ll send a one-time code. There’s no password to remember, and the same step creates your account if you’re new.</p>
      {notice && <p className="account-notice" role="alert">{notice}</p>}
      {/* A plain link: the sign-in route is a server redirect and must not be prefetched. */}
      <a className="button button-dark account-signin" href={`/account/login?return=${encodeURIComponent(returnTo)}`}>Continue with email<ArrowRight size={17}/></a>
      <p className="account-secure"><LockKeyhole size={13}/> Sign-in is handled securely by Shopify.</p>
    </div>
    <ul className="account-gate-list" aria-label="With your account">
      <li><strong>Orders</strong><span>Track deliveries and revisit past orders.</span></li>
      <li><strong>Subscriptions</strong><span>Pause, skip a delivery or cancel.</span></li>
      <li><strong>Addresses</strong><span>Save where your orders go.</span></li>
      <li><strong>Privacy</strong><span>Review your privacy choices.</span></li>
    </ul>
  </section>;
}

/** Loads a customer view model. A 401 flips the whole account area back to sign-in. */
export function useAccountData<T>(path: string | null) {
  const {reloadSession} = useAccount();
  const [state, setState] = useState<{status: "loading" | "ready" | "error"; data: T | null; error: string}>({status: "loading", data: null, error: ""});
  const [loads, setLoads] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    fetch(path, {cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(20000)})
      .then(async response => ({response, body: await response.json().catch(() => ({}))}))
      .then(({response, body}) => {
        if (!live) return;
        if (response.status === 401) { reloadSession(); return; }
        if (!response.ok) { setState({status: "error", data: null, error: body.message || (response.status === 404 ? "We couldn’t find that." : "We couldn’t load this right now.")}); return; }
        setState({status: "ready", data: body as T, error: ""});
      })
      .catch(() => { if (live) setState({status: "error", data: null, error: "We couldn’t load this right now. Check your connection and try again."}); });
    return () => { live = false; };
  }, [path, loads, reloadSession]);
  const reload = useCallback(() => { setState(previous => previous.data ? previous : {status: "loading", data: null, error: ""}); setLoads(n => n + 1); }, []);
  return {...state, reload, setData: (data: T) => setState({status: "ready", data, error: ""})};
}

export function useAccountMutation() {
  const {csrf, reloadSession} = useAccount();
  return useCallback(async <T,>(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(path, {method, credentials: "same-origin", headers: {"Content-Type": "application/json", "x-iqb-csrf": csrf}, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(20000)});
    } catch { throw new AccountRequestError(0, {message: "We couldn’t reach your account. Check your connection and try again."}); }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { reloadSession(); throw new AccountRequestError(401, data); }
    if (!response.ok) throw new AccountRequestError(response.status, data);
    return data as T;
  }, [csrf, reloadSession]);
}

// ---------- presentation helpers ----------

export function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = {month: "short", day: "numeric", year: "numeric"}) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-US", options).format(date);
}
export function formatMoney(value: Money | null | undefined) {
  if (!value) return "";
  try { return new Intl.NumberFormat("en-US", {style: "currency", currency: value.currencyCode || "USD"}).format(Number(value.amount)); }
  catch { return `${value.amount} ${value.currencyCode}`; }
}
export function cadenceLabel(cadence: {interval: string; count: number}) {
  const unit = {DAY: "day", WEEK: "week", MONTH: "month", YEAR: "year"}[cadence.interval] || "month";
  return cadence.count === 1 ? `Every ${unit}` : `Every ${cadence.count} ${unit}s`;
}

export function PageHeading({title, action}: {title: string; action?: ReactNode}) {
  return <div className="account-heading"><h1>{title}</h1>{action}</div>;
}
export function LoadingBlock({label}: {label: string}) {
  return <div className="account-skeleton" role="status" aria-label={label}><span/><span/><span/></div>;
}
export function ErrorBlock({message, retry}: {message: string; retry?: () => void}) {
  return <div className="account-error" role="alert"><p>{message}</p>{retry && <button className="under-link" onClick={retry}>Try again</button>}</div>;
}
export function EmptyBlock({title, action}: {title: string; action?: ReactNode}) {
  return <div className="account-empty"><p>{title}</p>{action}</div>;
}
