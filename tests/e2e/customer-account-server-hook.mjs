// Loaded into `next start` with NODE_OPTIONS=--import for browser tests ONLY.
// Routes server-side requests for https://shopify.com/* to the MOCK provider
// (tests/customer-account/fake-provider.mjs) and refuses every other external request.
import { createFakeProvider } from "../customer-account/fake-provider.mjs";

const provider = createFakeProvider({origin: process.env.CUSTOMER_ACCOUNT_PUBLIC_ORIGIN, file: process.env.FAKE_CUSTOMER_ACCOUNT_STATE});
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.startsWith("https://shopify.com/")) {
    const response = await provider.fetch(url, init);
    if (response) return response;
    return new Response("MOCK: unknown provider route", {status: 404});
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url)) return realFetch(input, init);
  throw new Error(`blocked external request in customer-account e2e: ${new URL(url).host}`);
};
