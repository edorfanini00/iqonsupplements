import content from "./product-copy.json";
/** Catalog copy based on supplied packaging and supplier specifications, with separate ingredient research.
 * Live Shopify product descriptions remain authoritative. */
export type ProductContent = {
  descriptor: string; description: string; highlights: string[];
  title: string; story: string;
  facts: { label: string; value: string; detail: string }[];
  faqs: { question: string; answer: string }[];
  benefits?: { title: string; body: string }[];
  ingredients?: { name: string; role: string; detail: string; amount?: string }[];
  routine?: { title: string; steps: { title: string; body: string }[]; note?: string };
  expectations?: { title: string; body: string };
  fit?: { label: string; value: string }[];
  formulaNote?: string;
  education?: { eyebrow: string; title: string; body: string; scope: string; sources: { label: string; url: string }[] };
};
export const productContent: Record<string, ProductContent> = content;
