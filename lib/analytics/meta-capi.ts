/**
 * Meta Conversions API: server side copy of the browser pixel events.
 *
 * Server only (uses node:crypto); never import from client components.
 * Each event carries the same event_id as its browser twin so Meta keeps one.
 *
 * Environment (server only):
 *   META_CAPI_ACCESS_TOKEN     Conversions API token. Missing: logs once, then every send is a no-op.
 *   NEXT_PUBLIC_META_PIXEL_ID  Dataset id (default 1006368245818889, "off" disables).
 *   META_GRAPH_VERSION         Graph API version, default v24.0.
 *   META_CAPI_TEST_EVENT_CODE  Events Manager > Test events code, for go live checks only.
 *
 * sendMetaEvents never throws and gives up after 3.5s.
 */
import { createHash } from "node:crypto";
import { resolvePixelId } from "./meta-shared";

export const CAPI_TIMEOUT_MS = 3500;
export const DEFAULT_GRAPH_VERSION = "v24.0";

type Env = Record<string, string | undefined>;

export interface MetaUserInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  /** Stable id we control (Shopify customer id). Hashed. */
  externalId?: string | null;
  /** Meta browser cookies and client signals: sent as is, never hashed. */
  fbp?: string | null;
  fbc?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

export interface MetaServerEvent {
  eventName: string;
  eventId: string;
  /** Unix seconds; defaults to now. */
  eventTime?: number;
  eventSourceUrl?: string | null;
  /** Default "website". Meta requires client_user_agent for website events. */
  actionSource?: "website" | "other";
  customData?: Record<string, unknown>;
  user: MetaUserInput;
}

export interface MetaSendResult {
  ok: boolean;
  skipped?: "missing_token" | "disabled" | "no_events";
  status?: number;
  error?: string;
}

export interface MetaSendDeps {
  env?: Env;
  fetch?: typeof fetch;
  log?: (message: string, detail?: Record<string, unknown>) => void;
  timeoutMs?: number;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Meta normalisation: trim and lowercase. */
export function normalizeText(value: string | null | undefined): string | null {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return v || null;
}
export function normalizeEmail(value: string | null | undefined): string | null {
  const v = normalizeText(value);
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}
/** Digits only, country code kept; a 10 digit number is taken as US/CA (store sells in USD). */
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = typeof value === "string" ? value.replace(/\D/g, "").replace(/^0+/, "") : "";
  if (digits.length < 7 || digits.length > 15) return null;
  return digits.length === 10 ? `1${digits}` : digits;
}
/** Names and city: lowercase letters only (Meta strips spaces and punctuation). */
export function normalizeLetters(value: string | null | undefined): string | null {
  const v = typeof value === "string" ? value.normalize("NFKC").toLowerCase().replace(/[\s\p{P}\p{S}\d]/gu, "") : "";
  return v || null;
}
/** US zip: first five digits; others lowercase without spaces. */
export function normalizeZip(value: string | null | undefined, country?: string | null): string | null {
  const v = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "") : "";
  if (!v) return null;
  if ((country ?? "").toLowerCase() === "us") return /^\d{5}/.test(v) ? v.slice(0, 5) : null;
  return v;
}
/** Two letter codes only (state and country). */
export function normalizeCode(value: string | null | undefined): string | null {
  const v = normalizeText(value);
  return v && /^[a-z]{2}$/.test(v) ? v : null;
}

export function hashValue(normalized: string | null): string | undefined {
  return normalized ? sha256(normalized) : undefined;
}

/** Builds Meta user_data: PII hashed with SHA-256 after normalisation, browser ids raw. */
export function buildUserData(u: MetaUserInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const country = normalizeCode(u.country);
  const hashed: [string, string | undefined][] = [
    ["em", hashValue(normalizeEmail(u.email))],
    ["ph", hashValue(normalizePhone(u.phone))],
    ["fn", hashValue(normalizeLetters(u.firstName))],
    ["ln", hashValue(normalizeLetters(u.lastName))],
    ["ct", hashValue(normalizeLetters(u.city))],
    ["st", hashValue(normalizeCode(u.state))],
    ["zp", hashValue(normalizeZip(u.zip, country))],
    ["country", hashValue(country)],
    ["external_id", hashValue(normalizeText(u.externalId))],
  ];
  for (const [key, value] of hashed) if (value) out[key] = [value];
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  if (u.clientIpAddress) out.client_ip_address = u.clientIpAddress;
  if (u.clientUserAgent) out.client_user_agent = u.clientUserAgent.slice(0, 500);
  return out;
}

export function buildPayload(events: MetaServerEvent[], env: Env, now = Date.now()): Record<string, unknown> {
  const testCode = env.META_CAPI_TEST_EVENT_CODE?.trim();
  return {
    data: events.map((e) => ({
      event_name: e.eventName,
      event_time: e.eventTime ?? Math.floor(now / 1000),
      event_id: e.eventId,
      action_source: e.actionSource ?? "website",
      ...(e.eventSourceUrl ? { event_source_url: e.eventSourceUrl } : {}),
      user_data: buildUserData(e.user),
      ...(e.customData ? { custom_data: e.customData } : {}),
    })),
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

let warnedMissingToken = false;
/** Test hook. */
export function resetMissingTokenWarning() {
  warnedMissingToken = false;
}

const defaultLog = (message: string, detail?: Record<string, unknown>) => console.warn(`[meta-capi] ${message}`, detail ? JSON.stringify(detail) : "");

export async function sendMetaEvents(events: MetaServerEvent[], deps: MetaSendDeps = {}): Promise<MetaSendResult> {
  const log = deps.log ?? defaultLog;
  try {
    const env = deps.env ?? process.env;
    const pixelId = resolvePixelId(env.NEXT_PUBLIC_META_PIXEL_ID);
    if (!pixelId) return { ok: false, skipped: "disabled" };
    const token = env.META_CAPI_ACCESS_TOKEN?.trim();
    if (!token) {
      if (!warnedMissingToken) {
        warnedMissingToken = true;
        log("META_CAPI_ACCESS_TOKEN is not set; server events are disabled.");
      }
      return { ok: false, skipped: "missing_token" };
    }
    if (!events.length) return { ok: false, skipped: "no_events" };
    const version = /^v\d{1,3}\.\d$/.test(env.META_GRAPH_VERSION?.trim() ?? "") ? env.META_GRAPH_VERSION!.trim() : DEFAULT_GRAPH_VERSION;
    // Token in the body, not the query string, so it never lands in URL logs.
    const body = JSON.stringify({ ...buildPayload(events, env), access_token: token });
    const response = await (deps.fetch ?? fetch)(`https://graph.facebook.com/${version}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(deps.timeoutMs ?? CAPI_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = (await response.text().catch(() => "")).replaceAll(token, "[token]").slice(0, 300);
      log("send failed", { events: events.map((e) => e.eventName), status: response.status, error: text });
      return { ok: false, status: response.status, error: text };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : "unknown_error";
    try {
      log("send error", { events: events.map((e) => e?.eventName), error: message });
    } catch {
      /* logging must not throw either */
    }
    return { ok: false, error: message };
  }
}

/** First address in x-forwarded-for (Vercel sets it at its edge), else x-real-ip. */
export function clientIp(headers: Headers): string | null {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || null;
}
