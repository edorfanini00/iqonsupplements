import content from "./product-copy.json";
/** Catalog copy based on supplied packaging and supplier specifications, with separate ingredient research.
 * Live Shopify product descriptions remain authoritative. */
export type ProductContent = {
  descriptor: string; description: string; highlights: string[];
  title: string; story: string;
  facts: { label: string; value: string; detail: string }[];
  faqs: { question: string; answer: string }[];
  education?: { eyebrow: string; title: string; body: string; scope: string; sources: { label: string; url: string }[] };
};
export const productContent: Record<string, ProductContent> = content;
