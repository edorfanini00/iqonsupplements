import type { Product, StoreCatalog } from "./catalog";
import { isOrderable } from "./commerce-policy";
import { formatOrder } from "./departments";
import { journalArticles, type JournalArticle } from "./journal";
import { productContent } from "./product-content";
import { supplementDetails } from "./supplement-details";

/** Links between guides, collections and product pages. Every fact shown is already published on the product page;
 * nothing here adds a claim, count or price. */
export const FORMAT_GUIDE = "finding-your-supplement-format";
export const LABEL_GUIDE = "reading-a-supplement-label";
type Section = JournalArticle["sections"][number];
type Mode = StoreCatalog["mode"];

/** Products a guide section discusses that can be ordered now, in catalog order. */
export function sectionProducts(section: Section, products: Product[], mode: Mode) {
  const named = section.format
    ? products.filter(p => p.category === "supplements" && p.type === section.format)
    : (section.products || []).flatMap(id => products.filter(p => p.id === id));
  return named.filter(p => isOrderable(p, mode));
}

/** The product-page fact that matches the section: package contents for a format, the formula difference for a label. */
export function sectionFact(section: Section, product: Product) {
  return section.format ? supplementDetails[product.id]?.contents : productContent[product.id]?.comparison?.difference;
}

/** Guides with a section about this product, or its format. Reciprocal to sectionProducts(). */
export function productGuides(product: Product) {
  return journalArticles.filter(article => article.sections.some(section =>
    product.category === "supplements" && (section.format ? section.format === product.type : section.products?.includes(product.id))));
}

/** Supplement formats a shopper can order now, in the collection's format order. */
export function orderableFormats(products: Product[], mode: Mode) {
  const types = new Set(products.filter(p => p.category === "supplements" && isOrderable(p, mode)).map(p => p.type));
  return formatOrder.filter(format => types.has(format));
}
