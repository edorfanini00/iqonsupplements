// Web Crypto only, so the same code runs on Vercel Node and the retained Worker target.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function fromBase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("invalid base64url");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
export function randomToken(bytes = 32) { return base64url(crypto.getRandomValues(new Uint8Array(bytes))); }

export async function pkceChallenge(verifier: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
}

/** Constant-time comparison for equal-length secrets; unequal lengths fail without early exit on content. */
export function safeEqual(a: string, b: string) {
  const left = encoder.encode(a), right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

const keyCache = new WeakMap<Uint8Array, Map<string, Promise<CryptoKey>>>();
// Separate keys per purpose: an encrypted login transaction can never be replayed as a session.
function derivedKey(secret: Uint8Array, purpose: string, usage: "aes" | "hmac") {
  let perSecret = keyCache.get(secret);
  if (!perSecret) keyCache.set(secret, perSecret = new Map());
  const id = `${usage}:${purpose}`;
  let key = perSecret.get(id);
  if (!key) {
    key = crypto.subtle.importKey("raw", secret as BufferSource, "HKDF", false, ["deriveKey"]).then(base =>
      crypto.subtle.deriveKey(
        {name: "HKDF", hash: "SHA-256", salt: encoder.encode("iqon-body-customer-account-v1"), info: encoder.encode(id)},
        base,
        usage === "aes" ? {name: "AES-GCM", length: 256} : {name: "HMAC", hash: "SHA-256", length: 256},
        false,
        usage === "aes" ? ["encrypt", "decrypt"] : ["sign", "verify"],
      ));
    perSecret.set(id, key);
  }
  return key;
}

export async function seal(secret: Uint8Array, purpose: string, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivedKey(secret, purpose, "aes");
  const cipher = new Uint8Array(await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: encoder.encode(purpose)}, key, encoder.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + cipher.length);
  out.set(iv); out.set(cipher, iv.length);
  return base64url(out);
}

/** Returns null for anything that was not produced by seal() with the same secret and purpose. */
export async function unseal<T>(secret: Uint8Array, purpose: string, value: string | undefined): Promise<T | null> {
  if (!value) return null;
  try {
    const bytes = fromBase64url(value);
    if (bytes.length < 12 + 16) return null;
    const key = await derivedKey(secret, purpose, "aes");
    const plain = await crypto.subtle.decrypt({name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: encoder.encode(purpose)}, key, bytes.slice(12));
    return JSON.parse(decoder.decode(plain)) as T;
  } catch { return null; }
}

export async function hmac(secret: Uint8Array, purpose: string, value: string) {
  const key = await derivedKey(secret, purpose, "hmac");
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}
