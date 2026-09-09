export type Category = "supplements" | "skincare";
export type Purchase = "once" | "subscription";
export type ProductVariant = {id:string; title:string; price:number; currency:string; available:boolean};
export type Product = {
  id: string; name: string; category: Category; type: string; number: string;
  price: number; size: string; descriptor: string; description: string;
  image: string; campaign: string; tone: string; ritual: string;
  currency?: string; available?: boolean; variants?: ProductVariant[];
  images?: {src:string; alt:string}[]; requiresSellingPlan?: boolean;
};
export type StoreCatalog = {mode:"preview"|"live"|"unavailable"; products:Product[]; currency:string};

// Provisional products and USD prices for the explicitly labelled store preview.
// Replace this catalog with approved product records before enabling commerce.
export const products: Product[] = [
  {id:"daily-complex",name:"Daily Complex",category:"supplements",type:"Daily nutrition",number:"01",price:68,size:"60 capsules",descriptor:"The everyday foundation.",description:"A simple starting point for a considered supplement routine. The Daily Complex concept brings everyday nutrition into one thoughtfully presented essential.",image:"/images/store/daily-complex.webp",campaign:"/images/store/campaign-supplements.webp",tone:"ivory",ritual:"Everyday essentials"},
  {id:"mineral-complex",name:"Mineral Complex",category:"supplements",type:"Minerals",number:"02",price:42,size:"60 capsules",descriptor:"A considered mineral essential.",description:"A focused addition to the daily collection. Mineral Complex is a capsule-format concept designed to sit naturally alongside your existing routine.",image:"/images/store/mineral-complex.webp",campaign:"/images/store/campaign-supplements.webp",tone:"sage",ritual:"Daily balance"},
  {id:"omega-complex",name:"Omega Complex",category:"supplements",type:"Omega oils",number:"03",price:54,size:"60 softgels",descriptor:"A place in your daily rhythm.",description:"The softgel expression of the IQON supplement collection. A restrained, practical format with the same attention to presentation and clarity.",image:"/images/store/omega-complex.webp",campaign:"/images/store/campaign-supplements.webp",tone:"charcoal",ritual:"Everyday essentials"},
  {id:"peptide-serum",name:"Peptide Serum",category:"skincare",type:"Serum",number:"04",price:88,size:"30 mL",descriptor:"Your daily treatment step.",description:"A serum concept at the heart of the IQON skincare ritual. Presented in frosted glass with a precise dispenser, it is designed as the treatment step between cleansing and moisturizing.",image:"/images/store/peptide-serum.webp",campaign:"/images/store/campaign-skincare.webp",tone:"silver",ritual:"Treat"},
  {id:"barrier-cream",name:"Barrier Cream",category:"skincare",type:"Moisturizer",number:"05",price:72,size:"50 mL",descriptor:"The finishing touch.",description:"A cream concept for the final moisturizing step in a simple skincare routine. A tactile glass jar and restrained finish bring the IQON approach to an everyday essential.",image:"/images/store/barrier-cream.webp",campaign:"/images/store/campaign-skincare.webp",tone:"ivory",ritual:"Moisturize"},
  {id:"gentle-cleanser",name:"Gentle Cleanser",category:"skincare",type:"Cleanser",number:"06",price:38,size:"150 mL",descriptor:"Begin with the essentials.",description:"The first step in the IQON skincare collection. This cleanser concept uses a practical pump format and pairs with the serum and cream as a three-part ritual.",image:"/images/store/gentle-cleanser.webp",campaign:"/images/store/campaign-skincare.webp",tone:"silver",ritual:"Cleanse"},
];

export const findProduct = (id: string) => products.find(p => p.id === id);
export const money = (amount: number, currency="USD") => new Intl.NumberFormat("en-US", {style:"currency",currency,maximumFractionDigits:amount % 1 ? 2 : 0}).format(amount);
export const unitPrice = (p: Product, purchase: Purchase) => purchase === "subscription" && !p.variants ? Math.round(p.price * 85) / 100 : p.price;
export type CartItem = {id: string; quantity: number; purchase: Purchase; frequency: string; lineId?:string; variantId?:string; variantTitle?:string; name?:string; image?:string; amount?:number; currency?:string};
export const lineKey = (item: Pick<CartItem,"id"|"purchase"|"frequency"|"lineId">) => item.lineId || `${item.id}:${item.purchase}:${item.frequency}`;
export function validateCart(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return [];
  return input.filter((i): i is CartItem => !!i && typeof i === "object" && typeof i.id === "string" && !!findProduct(i.id) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20 && ["once","subscription"].includes(i.purchase) && ["once","30","60","90"].includes(i.frequency));
}
