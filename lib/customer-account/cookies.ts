import type { CustomerAccountConfig } from "./config";

// The session cookie is a short opaque pointer (see session.ts); the transaction cookie is a
// small sealed value. Neither needs chunking.

export function cookieNames(config: Pick<CustomerAccountConfig, "secureCookies">) {
  const prefix = config.secureCookies ? "__Host-" : "";
  return {session: `${prefix}iqb_ca`, transaction: `${prefix}iqb_ca_tx`};
}

export function parseCookies(header: string | null): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    // First occurrence wins, matching browser ordering for the most specific path.
    if (!jar.has(name)) jar.set(name, part.slice(index + 1).trim());
  }
  return jar;
}

export function serializeCookie(config: Pick<CustomerAccountConfig, "secureCookies">, name: string, value: string, maxAge: number) {
  return [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", ...(config.secureCookies ? ["Secure"] : []), `Max-Age=${Math.max(0, Math.floor(maxAge))}`].join("; ");
}
