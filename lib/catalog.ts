import { productContent } from "./product-content";
export type Category = "supplements" | "skincare";
export type Purchase = "once" | "subscription";
export type ProductVariant = {id:string; title:string; price:number; currency:string; available:boolean};
export type Product = {
  id: string; name: string; category: Category; type: string; number: string;
  price: number; size: string; descriptor: string; description: string;
  image: string; campaign: string; tone: string; ritual: string;
  currency?: string; available?: boolean; pricePending?: boolean; variants?: ProductVariant[];
  images?: {src:string; alt:string}[]; requiresSellingPlan?: boolean;
};
export type StoreCatalog = {mode:"preview"|"live"|"unavailable"; products:Product[]; currency:string};

// Studio images regenerated from supplied IQON packaging. Sizes are transcribed from individual
// packshots; no price, inventory, formula, or dosage is inferred from an image.
export const SUPPLEMENT_COLLECTION_IMAGE = "/images/supplements/20_group_all_row.webp";
export const SUPPLEMENT_HERO_IMAGE = "/images/supplements/22_group_powders_row.webp";
const asset = (name: string) => `/images/supplements/${name}.webp`;
function supplement(
  id: string, name: string, type: string, size: string, descriptor: string,
  description: string, pack: string, detail: string, group: string, index: number,
): Product {
  return {
    id, name, category: "supplements", type, size, descriptor: productContent[id]?.descriptor || descriptor, description: productContent[id]?.description || description,
    number: String(index + 1).padStart(2, "0"), price: 0, pricePending: true,
    available: false, image: asset(pack), tone: "silver", ritual: "",
    campaign: type === "Powder" ? SUPPLEMENT_HERO_IMAGE
      : type === "Capsules" ? asset("21_group_capsules_row") : SUPPLEMENT_COLLECTION_IMAGE,
    images: [...new Set([pack, detail, group])].map((file, i) => ({
      src: i===1 && ["nmn","resveratrol"].includes(id) ? asset(`${id}-detail`) : i===2 && ["nmn","resveratrol"].includes(id) ? "/images/editorial/daily-water.webp" : asset(file), alt: i===2 && ["nmn","resveratrol"].includes(id) ? "A moment of water in an everyday routine" : i === 0 ? `IQON ${name} packaging`
        : i === 1 ? `IQON ${name} product detail` : `IQON collection featuring ${name}`,
    })),
  };
}
const previewProducts: Product[] = [
  supplement("creatine-monohydrate", "Creatine Monohydrate", "Powder", "281 g",
    "A focused powder essential.", "Creatine monohydrate in a 281 g powder format. Part of the IQON supplement collection.",
    "00_pack_creatine", "12_hero_creatine_scoop", "22_group_powders_row", 0),
  supplement("hydrolyzed-collagen-peptides", "Hydrolyzed Collagen Peptides", "Powder", "280 g",
    "Grass-fed. Unflavored.", "Unflavored, grass-fed hydrolyzed collagen peptides in a 280 g powder format.",
    "01_pack_collagen_no_flavor", "23_group_beauty_trio", "22_group_powders_row", 1),
  supplement("collagen-peptides-chocolate", "Grass-Fed Collagen Peptides", "Powder", "378 g · Chocolate",
    "The chocolate expression.", "Chocolate-flavored, grass-fed collagen peptides in a 378 g powder format.",
    "02_pack_collagen_chocolate", "13_hero_collagen_choc_scoop", "22_group_powders_row", 2),
  supplement("colostrum-powder", "Colostrum Powder", "Powder", "69 g",
    "A considered powder format.", "Colostrum powder in a 69 g jar. Explore the packaging and product details from the IQON collection.",
    "03_pack_colostrum_powder", "16_hero_colostrum_open", "23_group_beauty_trio", 3),
  supplement("colon-gentle-cleanse", "Colon Gentle Cleanse", "Sachets", "30 sachets",
    "Individually portioned sachets.", "Colon Gentle Cleanse in a jar of 30 individual sachets, with a resealable clear container.",
    "04_pack_colon_cleanse", "15_hero_colon_sachet", "20_group_all_row", 4),
  supplement("keto-5", "Keto-5", "Capsules", "60 capsules",
    "A capsule-format essential.", "Keto-5 in a 60-capsule bottle. One of the capsule formats in the IQON supplement collection.",
    "05_pack_keto5", "19_hero_glp1_keto_pair", "25_group_metabolic_trio", 5),
  supplement("glp-1-support", "GLP-1 Support", "Capsules", "60 capsules",
    "Part of the capsule collection.", "GLP-1 Support in a 60-capsule bottle, presented in the IQON collection’s muted blue finish.",
    "06_pack_glp1_support", "19_hero_glp1_keto_pair", "25_group_metabolic_trio", 6),
  supplement("liver-support", "Liver Support", "Capsules", "60 capsules",
    "A focused capsule format.", "Liver Support in a 60-capsule bottle, with the collection’s distinctive sage label.",
    "07_pack_liver_support", "11_hero_liver_capsules", "25_group_metabolic_trio", 7),
  supplement("nmn", "NMN", "Capsules", "30 capsules",
    "Precision in a capsule format.", "NMN in a 30-capsule bottle. Explore its packaging and the wider IQON capsule collection.",
    "08_pack_nmn", "17_hero_nmn_hand", "24_group_longevity_pair_hardshadow", 8),
  supplement("resveratrol", "Resveratrol", "Capsules", "60 capsules",
    "One considered essential.", "Resveratrol in a 60-capsule bottle, presented with IQON’s restrained mauve label.",
    "09_pack_resveratrol", "18_hero_resveratrol_hardshadow", "24_group_longevity_pair_hardshadow", 9),
  supplement("hair-skin-nails-gummies", "Hair, Skin & Nails Gummies", "Gummies", "60 gummies · Passion fruit",
    "A different kind of daily ritual.", "Passion-fruit-flavored Hair, Skin & Nails Gummies in a clear bottle of 60 gummies.",
    "10_pack_hair_and_skin_gummies", "14_hero_gummies_falling", "23_group_beauty_trio", 10),
  // Skincare concepts and sample USD prices remain for the labelled store preview.
  {id:"peptide-serum",name:"Peptide Serum",category:"skincare",type:"Serum",number:"12",price:88,size:"30 mL",descriptor:"Your daily treatment step.",description:"A serum concept at the heart of the IQON skincare ritual. Presented in frosted glass with a precise dispenser, it is designed as the treatment step between cleansing and moisturizing.",image:"/images/store/peptide-serum.webp",campaign:"/images/store/campaign-skincare.webp",tone:"silver",ritual:"Treat",images:[{src:"/images/store/peptide-serum.webp",alt:"IQON Peptide Serum packaging"},{src:"/images/editorial/iqon-serum-desktop.webp",alt:"A close look at the IQON Peptide Serum bottle"},{src:"/images/store/campaign-skincare.webp",alt:"The IQON skincare collection"}]},
  {id:"barrier-cream",name:"Barrier Cream",category:"skincare",type:"Moisturizer",number:"13",price:72,size:"50 mL",descriptor:"The finishing touch.",description:"A cream concept for the final moisturizing step in a simple skincare routine. A tactile glass jar and restrained finish bring the IQON approach to an everyday essential.",image:"/images/store/barrier-cream.webp",campaign:"/images/store/campaign-skincare.webp",tone:"ivory",ritual:"Moisturize"},
  {id:"gentle-cleanser",name:"Gentle Cleanser",category:"skincare",type:"Cleanser",number:"14",price:38,size:"150 mL",descriptor:"Begin with the essentials.",description:"The first step in the IQON skincare collection. This cleanser concept uses a practical pump format and pairs with the serum and cream as a three-part ritual.",image:"/images/store/gentle-cleanser.webp",campaign:"/images/store/campaign-skincare.webp",tone:"silver",ritual:"Cleanse"},
];

export const products: Product[] = previewProducts.map(p => ({...p, descriptor: productContent[p.id]?.descriptor || p.descriptor, description: productContent[p.id]?.description || p.description}));

export const findProduct = (id: string) => products.find(p => p.id === id);
export const money = (amount: number, currency="USD") => new Intl.NumberFormat("en-US", {style:"currency",currency,maximumFractionDigits:amount % 1 ? 2 : 0}).format(amount);
export const productPrice = (p: Product) => p.pricePending ? "Coming soon" : money(p.price, p.currency);
export const unitPrice = (p: Product, purchase: Purchase) => purchase === "subscription" && !p.variants ? Math.round(p.price * 85) / 100 : p.price;
export type CartItem = {id: string; quantity: number; purchase: Purchase; frequency: string; lineId?:string; variantId?:string; variantTitle?:string; name?:string; image?:string; amount?:number; currency?:string};
export const lineKey = (item: Pick<CartItem,"id"|"purchase"|"frequency"|"lineId">) => item.lineId || `${item.id}:${item.purchase}:${item.frequency}`;
export function validateCart(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return [];
  return input.filter((i): i is CartItem => !!i && typeof i === "object" && typeof i.id === "string" && !!findProduct(i.id) && !findProduct(i.id)?.pricePending && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20 && ["once","subscription"].includes(i.purchase) && ["once","30","60","90"].includes(i.frequency));
}
