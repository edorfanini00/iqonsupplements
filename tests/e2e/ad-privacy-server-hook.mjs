// Loaded into `next start` with NODE_OPTIONS=--import for the advertising-privacy browser tests ONLY.
// Routes the Storefront API to the MOCK in fake-shopify-storefront.mjs and refuses every other
// external request, so no real Shopify, Meta or other service can be reached.
import { STORE, handleStorefront } from "./fake-shopify-storefront.mjs";

const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.startsWith(`https://${STORE}/api/`)) {
    const delay = Number(process.env.FAKE_SHOPIFY_DELAY_MS || 0);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    return handleStorefront(process.env.FAKE_SHOPIFY_STATE, init.body);
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in ad-privacy e2e: ${new URL(url).host}`);
};
