import {money, unitPrice, type Product} from "./catalog";
import {isComingSoon} from "./commerce-policy";

import labelData from "./verified-label-data.json";

/** Original IQON label PDFs recovered and visually inspected 7 November 2026.
 * See docs/qa/premium-site/recovered-label-provenance.json for exact versions/hashes.
 * Printed artwork establishes label amounts, not clinical or batch testing. */
export const verifiedLabels: Record<string, {
 packSize:string; servings:number; serving:string; active:string; durationNote?:string;
 nutrition:{name:string;amount:string;dailyValue?:string;note?:string}[];
}> = labelData;

/** A serving claim belongs to the verified pack, not arbitrary new sizes or variants. */
export function verifiedPackLabel(product:Product) {
 const label=verifiedLabels[product.id];
 if(!label||(product.size&&product.size!==label.packSize)||(product.variants?.length||0)>1)return null;
 // A merchant supplied alternate pack title must not inherit the single approved pack's count.
 const title=product.variants?.[0]?.title;
 if(title&&title!=="Default Title"&&title!==label.packSize)return null;
 return label;
}
export function servingPrice(product:Product,price=unitPrice(product),currency=product.currency) {
 const label=verifiedPackLabel(product);
 return !isComingSoon(product)&&!product.pricePending&&label&&Number.isFinite(price)&&price>0?money(price/label.servings,currency):null;
}
