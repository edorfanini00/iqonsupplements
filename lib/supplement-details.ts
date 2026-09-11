/** Product information transcribed from the supplier screenshots supplied on 10 September 2026.
 * These are ingredient statements, not complete Supplement Facts panels. Do not infer Daily Values
 * or undisclosed ingredient amounts. Shopify inventory and checkout remain authoritative. */
export type SupplementDetails = {
  country: string;
  contents: string;
  netWeight?: string;
  grossWeight: string;
  flavor?: string;
  ingredients: string;
  amounts?: { ingredient: string; amount: string; detail?: string }[];
  directions: string[];
  cautions: string[];
  storage: string;
  allergens?: string[];
  notes?: string[];
  dietary: string[];
};

const storage = "Keep out of reach of children. Do not use if the safety seal is damaged or missing. Store in a cool, dry place.";
const standardCaution = "Do not exceed the recommended dose. Pregnant or nursing mothers, children under 18, and individuals with a known medical condition should consult a physician before using this or any dietary supplement.";
const shortCaution = "Do not exceed the recommended dose. Consult a physician if pregnant, nursing, under 18, or if you have a medical condition.";

export const supplementDisclaimer = "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.";

export const supplementDetails: Record<string, SupplementDetails> = {
  "keto-5": {
    country: "USA", contents: "60 capsules", grossWeight: "74 g",
    ingredients: "Keto Blend (Raspberry Ketone, Green Tea, Caffeine Anhydrous, Green Coffee Bean, Garcinia Cambogia fruit), Cellulose (vegetable capsule).",
    directions: ["Take one (1) capsule twice a day as a dietary supplement. For best results, take 20–30 minutes before a meal with an 8 oz (236 ml) glass of water, or as directed by your healthcare professional."],
    cautions: [standardCaution], storage,
    dietary: ["Gluten-free", "Vegetarian", "Lactose-free", "Allergen-free", "Hormone-free", "No fillers", "Vegan"],
  },
  "hair-skin-nails-gummies": {
    country: "USA", contents: "60 gummies", netWeight: "150 g", grossWeight: "186 g", flavor: "Passion fruit",
    ingredients: "Vitamin A (as retinyl acetate), Vitamin C (as ascorbic acid), Vitamin D (as cholecalciferol), Vitamin E (as dl-Alpha tocopheryl acetate), Vitamin B-6 (as pyridoxine HCl), Folate, Vitamin B-12 (as cyanocobalamin), Biotin, Pantothenic Acid (as calcium d-pantothenate), Iodine (as potassium iodide), Zinc (as zinc citrate), PABA (para-Aminobenzoic Acid), Collagen (piscine), Silicon, Glucose syrup, Sugar, Glucose, Pectin, Citric acid, Sodium citrate, Passion fruit flavor, Vegetable oil (contains carnauba wax), Purple carrot juice concentrate.",
    directions: ["Take two (2) gummies daily, or as directed by a healthcare professional."],
    cautions: ["Take only as directed. Do not exceed the suggested dosage. Pregnant or nursing mothers, children under 18, or individuals with a known medical condition should consult a physician before using this or any dietary supplement."],
    allergens: ["Contains fish-derived (piscine) collagen.", "Manufactured and packaged in a facility that may also process milk, soy, wheat, eggs, peanuts, tree nuts, fish, and crustacean shellfish."],
    notes: ["The product may settle during shipping. Natural colors may darken over time; this does not affect potency."],
    storage, dietary: [],
  },
  "liver-support": {
    country: "USA", contents: "60 capsules", grossWeight: "68 g",
    ingredients: "Turmeric Powder (root); Beet Root Powder (Beta vulgaris, root); Dandelion Powder (leaf); Artichoke Extract (Cynara scolymus, whole herb, standardized to 5% Cynarin); Ginger Powder (root); Milk Thistle Powder; Alfalfa Powder (leaf); L-Cysteine Hydrochloride.",
    directions: ["As a dietary supplement, adults take two (2) capsules daily. For best results, take with 6–8 oz of water, or as directed by a healthcare professional."],
    cautions: [standardCaution], storage, dietary: ["Non-GMO"],
  },
  "resveratrol": {
    country: "USA", contents: "60 capsules", grossWeight: "68 g",
    ingredients: "Resveratrol (Polygonum cuspidatum, root) complex containing 50% trans-resveratrol (600 mg), Hypromellose (vegetable capsule), Microcrystalline Cellulose.",
    amounts: [{ingredient: "Resveratrol root complex", amount: "600 mg", detail: "Standardized to 50% trans-resveratrol; the listed 600 mg refers to the complex."}],
    directions: ["Take one (1) veggie capsule twice a day as a dietary supplement. For best results, take 20–30 minutes before a meal, or as directed by your healthcare professional."],
    cautions: [standardCaution], storage, dietary: [],
  },
  "colon-gentle-cleanse": {
    country: "Latvia", contents: "30 sachets", netWeight: "90 g", grossWeight: "159 g",
    ingredients: "Psyllium husk (Plantago ovata) seed powder, Tamarind (Tamarindus indica) fruit extract, Digestive Enzyme blend from fermented cereals (amylase, lactase, lipase, cellulase), Ginger root (Zingiber officinale Roscoe).",
    directions: ["Take one sachet once or twice a day, separate from meals. Pour the contents into a glass filled with non-carbonated water (6.76 fl oz / 200 ml), stir well, and drink immediately.", "Take no earlier than 2 hours after medication."],
    cautions: ["Not recommended for anyone with sensitivity to the components or for children under 12. Do not exceed the recommended daily dose. This dietary supplement must not be used as a substitute for a complete diet. Consult your doctor before use."],
    notes: ["A change to a jelly-like consistency is characteristic of the preparation and does not affect product quality."],
    storage: "", dietary: [],
  },
  "nmn": {
    country: "USA", contents: "30 capsules", netWeight: "36 g", grossWeight: "45 g",
    ingredients: "β-Nicotinamide Mononucleotide (500 mg), HPMC (vegetable capsule), Microcrystalline Cellulose, Silicon Dioxide, Magnesium Stearate.",
    amounts: [{ingredient: "β-Nicotinamide Mononucleotide (NMN)", amount: "500 mg", detail: "Per serving; stated purity 99.9%."}],
    directions: ["As a dietary supplement, adults take one (1) capsule daily. For best results, take with 6–8 oz (177–237 ml) of water, or as directed by a healthcare professional."],
    cautions: [shortCaution], storage,
    dietary: ["Gluten-free", "Lactose-free", "Allergen-free", "Antibiotic-free", "Hormone-free", "Alcohol-free", "Vegan", "Vegetarian"],
  },
  "glp-1-support": {
    country: "USA", contents: "60 capsules", netWeight: "47 g", grossWeight: "65 g",
    ingredients: "Vitamin D3 (as cholecalciferol) 50 mcg, Vitamin B6 (as pyridoxal 5′-phosphate) 26 mg, Folate (from L-5-MTHF-Ca) 400 mcg DFE, Vitamin B12 (as methylcobalamin 1%) 525 mcg, Biotin 5 mcg, Iron (as ferrous bisglycinate chelate) 18 mg, Magnesium (as magnesium oxide and magnesium citrate) 200 mg, Zinc (as zinc bisglycinate chelate) 20 mg, Digestive Comfort & Soothing Blend 325 mg [Gingerols™ Ginger Root Extract (Zingiber officinale, standardized to 5% Gingerols), Peppermint Extract (leaf), Bromelain Powder (Ananas comosus, stem, standardized to 2400 GDU/g), DigeZyme®], LactoSpore® (Bacillus coagulans) 166 mg, Energy & Vitality Complex 126 mg [Ashwagandha Extract (root, 5% withanolides), Vitamin B12 (as methylcobalamin), Vitamin B6 (as pyridoxal 5′-phosphate), Folate (as calcium L-5 methyltetrahydrofolate)], Nutrient Replenishment Matrix 22 mg [Zinc (as zinc bisglycinate chelate), Iron (as ferrous bisglycinate chelate), Biotin, Vitamin D3 (as cholecalciferol)], BioPerine® Black Pepper Extract (fruit) 5 mg, Microcrystalline Cellulose, Medium Chain Triglycerides (MCT Oil), Silicon Dioxide, Magnesium Stearate, Hypromellose (vegetable capsule).",
    amounts: [
      {ingredient: "Vitamin D3", amount: "50 mcg", detail: "Cholecalciferol"},
      {ingredient: "Vitamin B6", amount: "26 mg", detail: "Pyridoxal 5′-phosphate"},
      {ingredient: "Folate", amount: "400 mcg DFE", detail: "From L-5-MTHF-Ca"},
      {ingredient: "Vitamin B12", amount: "525 mcg", detail: "Methylcobalamin 1%"},
      {ingredient: "Biotin", amount: "5 mcg"},
      {ingredient: "Iron", amount: "18 mg", detail: "Ferrous bisglycinate chelate"},
      {ingredient: "Magnesium", amount: "200 mg", detail: "Magnesium oxide and magnesium citrate"},
      {ingredient: "Zinc", amount: "20 mg", detail: "Zinc bisglycinate chelate"},
      {ingredient: "Digestive Comfort & Soothing Blend", amount: "325 mg", detail: "Gingerols™ ginger, peppermint, bromelain and DigeZyme®"},
      {ingredient: "LactoSpore®", amount: "166 mg", detail: "Bacillus coagulans"},
      {ingredient: "Energy & Vitality Complex", amount: "126 mg", detail: "Ashwagandha, vitamin B12, vitamin B6 and folate"},
      {ingredient: "Nutrient Replenishment Matrix", amount: "22 mg", detail: "Zinc, iron, biotin and vitamin D3"},
      {ingredient: "BioPerine® Black Pepper Extract", amount: "5 mg", detail: "Fruit extract"},
    ],
    directions: ["As a dietary supplement, adults take two (2) capsules daily. For best results, take with 6–8 oz (177–237 ml) of water, or as directed by a healthcare professional."],
    cautions: ["Accidental overdose of iron-containing products is a leading cause of fatal poisoning in children under 6. Keep this product out of reach of children. In case of accidental overdose, call a doctor or poison control center immediately.", shortCaution],
    storage, dietary: ["Non-GMO", "Gluten-free", "Lactose-free", "Allergen-free", "Antibiotic-free", "Hormone-free", "Alcohol-free", "Vegetarian"],
  },
  "collagen-peptides-chocolate": {
    country: "USA", contents: "378 g powder", netWeight: "378 g", grossWeight: "499 g", flavor: "Chocolate",
    ingredients: "Hydrolyzed Collagen Peptides (from bovine hide), Cocoa Powder, Acacia Powder, Natural Flavor, Sodium Chloride, Xanthan Gum, Stevia Extract Powder (Reb A), Silica.",
    directions: ["As a dietary supplement, adults mix two (2) scoops with 8–10 oz (236–295 ml) of a favorite beverage in a shaker cup or blender."],
    cautions: [], storage: `${storage} Keep away from direct light.`, dietary: ["Gluten-free", "Non-GMO"],
  },
  "hydrolyzed-collagen-peptides": {
    country: "USA", contents: "280 g powder", netWeight: "280 g", grossWeight: "376 g", flavor: "Unflavored",
    ingredients: "Bovine Hide Collagen Peptides.",
    directions: ["Add one (1) level scoop to 8–10 oz (236–295 ml) of chilled water or a preferred beverage in a shaker cup. Mix for about 5 seconds. Drink and enjoy a shake each day."],
    cautions: [], storage, dietary: ["Gluten-free", "Lactose-free", "Corn-free"],
  },
  "colostrum-powder": {
    country: "USA", contents: "69 g powder", netWeight: "69 g", grossWeight: "114 g",
    ingredients: "Bovine Colostrum (25% Immunoglobulin G) 2300 mg, providing Immunoglobulins (IgG) 575 mg.",
    amounts: [{ingredient: "Bovine colostrum", amount: "2300 mg", detail: "Per serving; standardized to 25% Immunoglobulin G."}, {ingredient: "Immunoglobulins (IgG)", amount: "575 mg", detail: "Provided by the bovine colostrum, not an additional serving amount."}],
    directions: ["For adults only. Use one (1) scoop of powder in 6–8 oz (177–237 ml) of cold water or a favorite beverage. Consume within 10 minutes of mixing."],
    cautions: [standardCaution], allergens: ["Bovine colostrum is derived from milk."], storage, dietary: ["Gluten-free", "Vegetarian", "Non-GMO"],
  },
  "creatine-monohydrate": {
    country: "USA", contents: "281 g powder", netWeight: "281 g", grossWeight: "281 g", flavor: "Unflavored",
    ingredients: "Creatine Monohydrate.",
    directions: ["As a dietary supplement, adults take one (1) scoop in eight (8) oz of water or juice four (4) times daily during the first five (5) days (loading phase). After the loading phase, take one (1) or two (2) times daily, or as directed by a healthcare professional."],
    cautions: [], storage: `${storage} Keep away from direct light.`, dietary: ["Gluten-free", "Lactose-free", "Non-GMO", "Corn-free", "Vegan"],
  },
};
