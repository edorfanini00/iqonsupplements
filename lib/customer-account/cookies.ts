import type { CustomerAccountConfig } from "./config";

// Browsers reject cookies whose name=value exceeds 4096 bytes. Encrypted envelopes are
// split into numbered chunks well below that, and capped so a bad envelope fails loudly.
export const CHUNK_SIZE = 3800;
export const MAX_CHUNKS = 4;

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

export function readChunked(jar: Map<string, string>, base: string): {value: string | undefined; chunks: number} {
  let value = "", chunks = 0;
  for (; chunks < MAX_CHUNKS + 1; chunks++) {
    const part = jar.get(`${base}.${chunks}`);
    if (part === undefined) break;
    value += part;
  }
  // More chunks than the budget, or more bytes than it allows, is never ours: fail closed. A gap,
  // reordering or mixing chunks from two envelopes fails AES-GCM authentication in unseal().
  const valid = chunks > 0 && chunks <= MAX_CHUNKS && value.length <= CHUNK_SIZE * MAX_CHUNKS;
  return {value: valid ? value : undefined, chunks};
}

/** Set-Cookie headers for a chunked value; also expires stale higher-numbered chunks. */
export function writeChunked(config: Pick<CustomerAccountConfig, "secureCookies">, base: string, value: string, maxAge: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_SIZE) parts.push(value.slice(i, i + CHUNK_SIZE));
  if (parts.length > MAX_CHUNKS) throw new Error("customer session envelope exceeds the cookie budget");
  const headers = parts.map((part, i) => serializeCookie(config, `${base}.${i}`, part, maxAge));
  for (let i = parts.length; i < MAX_CHUNKS; i++) headers.push(serializeCookie(config, `${base}.${i}`, "", 0));
  return headers;
}

export function clearChunked(config: Pick<CustomerAccountConfig, "secureCookies">, base: string) {
  return Array.from({length: MAX_CHUNKS}, (_, i) => serializeCookie(config, `${base}.${i}`, "", 0));
}
