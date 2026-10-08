import { createHmac, timingSafeEqual } from "node:crypto";
export const SUPPLEMENTS_SHOP = "nr9zd0-t5.myshopify.com";
export const MAX_BODY_BYTES = 1_000_000;
export type BodyReadResult = { ok: true; body: Buffer } | { ok: false; status: 400 | 408 | 413; reason: "invalid_body" | "body_timeout" | "too_large" };
export async function readLimitedBody(request: Request, max = MAX_BODY_BYTES, deadlineMs = 2000): Promise<BodyReadResult> {
  const tooLarge = { ok: false, status: 413, reason: "too_large" } as const;
  if (Number(request.headers.get("content-length") ?? 0) > max) { void request.body?.cancel().catch(() => {}); return tooLarge; }
  if (!request.body) return { ok: true, body: Buffer.alloc(0) };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), deadlineMs); });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), deadline]);
      if (next === "timeout") { void reader.cancel().catch(() => {}); return { ok: false, status: 408, reason: "body_timeout" }; }
      if (next.done) return { ok: true, body: Buffer.concat(chunks) };
      size += next.value.byteLength;
      if (size > max) { void reader.cancel().catch(() => {}); return tooLarge; }
      chunks.push(next.value);
    }
  } catch { return { ok: false, status: 400, reason: "invalid_body" }; }
  finally { clearTimeout(timer); reader.releaseLock(); }
}
export function verifyShopifyHmac(raw: Buffer, signature: string | null, secret: string): boolean {
  if (!signature || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret.trim()).update(raw).digest();
  const actual = Buffer.from(signature, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function isSubscriptionRenewal(payload: unknown): { renewal: boolean } {
  if (!payload || typeof payload !== "object") return { renewal: false };
  const order = payload as Record<string, unknown>;
  const source = typeof order.source_name === "string" ? order.source_name.toLowerCase() : "";
  const tags = typeof order.tags === "string" ? order.tags.toLowerCase().split(",").map(t => t.trim()) : [];
  return { renewal: source.startsWith("subscription_contract") || tags.includes("subscription recurring order") };
}
