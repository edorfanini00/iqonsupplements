import sanitizeHtml from "sanitize-html";
import { findStorePolicy, STORE_POLICY_LINKS, type StorePolicy } from "./store-policies";

export const POLICY_CACHE_MS = 60_000;
export const POLICY_FAILURE_CACHE_MS = 5_000;
export const POLICY_TIMEOUT_MS = 5_000;
export const POLICY_MAX_BYTES = 128 * 1024;
export type PolicyContent = {title: string; body: string};

/** Treat even merchant-managed HTML as untrusted. No scripts, media, forms, styles,
 * event handlers, arbitrary attributes or extra H1s can enter the document. */
export function sanitizePolicyBody(body: string) {
  return sanitizeHtml(body, {
    allowedTags: ["p", "br", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "blockquote", "a", "span", "div", "hr"],
    allowedAttributes: {a: ["href", "title"]},
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const native = STORE_POLICY_LINKS.find(policy => attribs.href === policy.fallbackUrl);
        return {tagName, attribs: {...attribs, ...(native ? {href: native.href} : {})}};
      },
    },
  }).trim();
}

async function readPolicy(policy: StorePolicy, fetcher: typeof fetch): Promise<PolicyContent | null> {
  // Fixed allowlisted URLs only; no credentials, buyer headers or cookies are needed.
  const response = await fetcher(policy.sourceUrl, {
    headers: {Accept: "application/json"}, cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(POLICY_TIMEOUT_MS),
  });
  if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "") ||
      Number(response.headers.get("content-length")) > POLICY_MAX_BYTES) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > POLICY_MAX_BYTES) {await reader.cancel(); return null;}
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
  const data = JSON.parse(new TextDecoder().decode(bytes))?.policy;
  if (!data || data.handle !== policy.slug || typeof data.title !== "string" || !data.title.trim() || data.title.length > 250 || typeof data.body !== "string") return null;
  const body = sanitizePolicyBody(data.body);
  // Empty/removed/unpublished policies must show the fallback, not a blank success.
  const text = sanitizeHtml(body, {allowedTags: [], allowedAttributes: {}});
  if (!text.replace(/&(?:nbsp|#160|#xA0);/gi, " ").trim()) return null;
  return {title: data.title.trim(), body};
}

/** Five public entries maximum, with request coalescing and a hard expiry (no
 * indefinitely stale policy on outages). Failures retry after five seconds.
 * Per-process cache also works on the retained Worker target. */
export function createPolicyLoader(fetcher: typeof fetch = fetch, now = Date.now) {
  const entries = new Map<string, {value: PolicyContent | null; expires: number}>();
  const pending = new Map<string, Promise<PolicyContent | null>>();
  return async function loadPolicy(slug: string): Promise<PolicyContent | null> {
    const policy = findStorePolicy(slug);
    if (!policy) return null;
    const entry = entries.get(slug);
    if (entry && entry.expires > now()) return entry.value;
    const current = pending.get(slug);
    if (current) return current;
    const task = readPolicy(policy, fetcher).catch(() => null).then(value => {
      entries.set(slug, {value, expires: now() + (value ? POLICY_CACHE_MS : POLICY_FAILURE_CACHE_MS)});
      pending.delete(slug);
      return value;
    });
    pending.set(slug, task);
    return task;
  };
}
