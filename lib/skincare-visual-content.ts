/** Short-form editorial copy from the existing supplier-grounded product copy.
 * Molecules show the named ingredient, not finished-product efficacy. */
export type IngredientVisual = {
  art: string; artLabel: string; kind: "molecule" | "peptide" | "moisture" | "emollient" | "botanical";
  summary: string; tags: string[];
};
export type SkinVisualContent = {
  texture: string;
  benefits: { title: string; body: string; icon: "droplet" | "layers" | "spark" | "face" | "moon" | "sun" | "feather" | "rinse" }[];
  ingredients: IngredientVisual[];
  routineTitle: string; timing: string; steps: { title: string; body: string; icon: "cleanse" | "apply" | "sun" | "moon" | "layers" | "pad" | "eye" }[];
};
export const skincareVisualContent: Record<string, SkinVisualContent> = {
  "copper-peptide-restore-cream": {
    texture: "Rich cream / soft finish",
    benefits: [
      {title:"Peptide care",body:"Copper peptide with a supporting peptide blend.",icon:"layers"},
      {title:"Cushioned moisture",body:"Shea butter adds richness and softness.",icon:"feather"},
      {title:"Water binding",body:"Glycerin and hyaluronate bring hydration.",icon:"droplet"},
      {title:"A finishing step",body:"Apply after your chosen serum.",icon:"face"}
    ],
    ingredients: [
      {art:"copper-peptide",artLabel:"Copper tripeptide-1 / GHK-Cu",kind:"molecule",summary:"GHK-Cu joins three other peptides in a richer moisturizing step.",tags:["PEPTIDE CARE","FIRMER-LOOKING SKIN"]},
      {art:"emollient",artLabel:"Emollient care",kind:"emollient",summary:"A rich emollient that softens the feel of skin.",tags:["SOFTNESS","RICHER TEXTURE"]},
      {art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Water-binding ingredients complement the cream’s emollients.",tags:["HUMECTANTS","HYDRATION"]}
    ],
    routineTitle:"Finish with richer care.",timing:"AFTER YOUR SERUM",
    steps:[{title:"Prepare",body:"Cleanse, then apply your chosen serum.",icon:"cleanse"},{title:"Smooth",body:"Apply the cream to your face and neck.",icon:"apply"},{title:"Complete",body:"Account for other retinol products. Use SPF by day.",icon:"sun"}]
  },
  "retinol-rx": {
    texture:"Evening serum / targeted care",
    benefits:[{title:"Refine texture",body:"For the appearance of uneven skin texture.",icon:"face"},{title:"Care for fine lines",body:"A targeted retinol treatment step.",icon:"spark"},{title:"Considered delivery",body:"Encapsulation protects retinol and releases it gradually.",icon:"layers"},{title:"Moisture support",body:"Squalane and hyaluronate round out the formula.",icon:"droplet"}],
    ingredients:[{art:"retinol",artLabel:"Retinol",kind:"molecule",summary:"Encapsulated to help protect retinol and allow gradual release.",tags:["ENCAPSULATED","TEXTURE + FINE LINES"]},{art:"niacinamide",artLabel:"Niacinamide / vitamin B3",kind:"molecule",summary:"Vitamin B3 complements the retinol treatment.",tags:["VITAMIN B3","FORMULA SUPPORT"]},{art:"squalane",artLabel:"Squalane",kind:"molecule",summary:"Emollient softness pairs with water-binding hydration.",tags:["SOFTNESS","MOISTURE"]}],
    routineTitle:"An evening ritual, at your pace.",timing:"PM / INTRODUCE GRADUALLY",
    steps:[{title:"Evening care",body:"Apply as directed in a simple evening routine.",icon:"moon"},{title:"Build gradually",body:"Adjust frequency to your skin’s tolerance.",icon:"layers"},{title:"Protect by day",body:"Use SPF 30 or higher during the day.",icon:"sun"}]
  },
  "hydra-c-ferulic-serum": {
    texture:"Daily serum / lightweight hydration",
    benefits:[{title:"Brighter-looking skin",body:"Vitamin C care for a dull-looking complexion.",icon:"spark"},{title:"Antioxidants, paired",body:"Ascorbic acid and ferulic acid together.",icon:"layers"},{title:"A hydration layer",body:"Sodium hyaluronate binds water.",icon:"droplet"},{title:"Everyday care",body:"A serum step for morning or evening.",icon:"sun"}],
    ingredients:[{art:"vitamin-c",artLabel:"Ascorbic acid / vitamin C",kind:"molecule",summary:"The vitamin C form in the serum, for antioxidant care and radiance.",tags:["ANTIOXIDANT","BRIGHTNESS"]},{art:"ferulic-acid",artLabel:"Ferulic acid",kind:"molecule",summary:"A complementary antioxidant that helps stabilize vitamin C.",tags:["ANTIOXIDANT PARTNER","FORMULA SUPPORT"]},{art:"moisture",artLabel:"Water-binding care",kind:"moisture",summary:"A humectant that adds hydration alongside the antioxidants.",tags:["HUMECTANT","HYDRATION"]}],
    routineTitle:"Your daily antioxidant step.",timing:"AM + PM / BEFORE MOISTURIZER",
    steps:[{title:"Prepare",body:"Cleanse and apply your tonic if you use one.",icon:"cleanse"},{title:"Apply",body:"Smooth a small amount over the face and neck.",icon:"apply"},{title:"Layer",body:"Follow with moisturizer and sunscreen by day.",icon:"sun"}]
  },
  "exfoliating-pads": {
    texture:"Pre-moistened pads / focused application",
    benefits:[{title:"Refined texture",body:"A focused step for uneven-looking skin.",icon:"face"},{title:"AHA + BHA",body:"Mandelic, lactic and salicylic acids.",icon:"layers"},{title:"Targeted application",body:"A ready-to-use pad for your chosen areas.",icon:"feather"},{title:"Daily sun care",body:"Pair your exfoliating routine with sunscreen.",icon:"sun"}],
    ingredients:[{art:"mandelic-acid",artLabel:"Mandelic acid / AHA",kind:"molecule",summary:"Two alpha hydroxy acids for surface exfoliation.",tags:["AHA","SURFACE TEXTURE"]},{art:"salicylic-acid",artLabel:"Salicylic acid / BHA",kind:"molecule",summary:"The beta hydroxy acid component for congested-looking skin.",tags:["BHA","TARGETED CARE"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Moisture-binding care alongside chamomile, licorice and green tea.",tags:["HUMECTANT","SUPPORTING BOTANICALS"]}],
    routineTitle:"Sweep. Refine. Follow with care.",timing:"FOLLOW THE LABEL FOR FREQUENCY",
    steps:[{title:"Cleanse",body:"Begin with clean skin before exfoliating.",icon:"cleanse"},{title:"Sweep",body:"Apply to targeted areas, avoiding the eyes.",icon:"pad"},{title:"Follow with care",body:"Moisturize and use daily sun protection.",icon:"sun"}]
  },
  "hydrating-tonic": {
    texture:"Water-light tonic / fresh hydration",
    benefits:[{title:"Light hydration",body:"Moisture without a rich cream texture.",icon:"droplet"},{title:"Humectant pairing",body:"Glycerin and sodium PCA bind water.",icon:"layers"},{title:"Conditioning care",body:"Aloe and panthenol support the formula.",icon:"feather"},{title:"Between steps",body:"After cleansing, before your serum.",icon:"rinse"}],
    ingredients:[{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"A water-attracting ingredient for a hydrated skin feel.",tags:["HUMECTANT","LIGHT HYDRATION"]},{art:"sodium-pca",artLabel:"Sodium PCA",kind:"molecule",summary:"A second humectant that complements glycerin.",tags:["WATER BINDING","MOISTURE"]},{art:"panthenol",artLabel:"Panthenol / provitamin B5",kind:"molecule",summary:"Conditioning ingredients in a water-light formula.",tags:["CONDITIONING","LIGHTWEIGHT"]}],
    routineTitle:"A light layer before treatment.",timing:"AM + PM / AFTER CLEANSING",
    steps:[{title:"Cleanse",body:"Start with freshly cleansed, rinsed skin.",icon:"cleanse"},{title:"Sweep",body:"Use a cotton pad over the face and neck.",icon:"pad"},{title:"Continue",body:"Follow with your chosen serum and moisturizer.",icon:"layers"}]
  },
  "firming-peptide-eye-gel": {
    texture:"Light gel / targeted eye care",
    benefits:[{title:"A focused step",body:"Peptide care for the eye area.",icon:"face"},{title:"A lighter feel",body:"A gel texture for those who prefer less richness.",icon:"feather"},{title:"Peptide blend",body:"Three named peptides in the formula.",icon:"layers"},{title:"Moisture support",body:"Glycerin and sodium PCA add hydration.",icon:"droplet"}],
    ingredients:[{art:"palmitoyl-tripeptide",artLabel:"Palmitoyl tripeptide-1",kind:"molecule",summary:"Palmitoyl tripeptide-5, tripeptide-1 and tetrapeptide-7.",tags:["PEPTIDE CARE","EYE-AREA FOCUS"]},{art:"botanical",artLabel:"Botanical conditioning",kind:"botanical",summary:"Botanical conditioning complements the light gel texture.",tags:["ALOE + CUCUMBER WATER","CONDITIONING"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Water-binding humectants bring hydration to the eye step.",tags:["HUMECTANTS","LIGHT HYDRATION"]}],
    routineTitle:"A small amount. A gentle touch.",timing:"AM + PM / AFTER CLEANSING",
    steps:[{title:"Start clean",body:"Apply after cleansing your skin.",icon:"cleanse"},{title:"Pat gently",body:"Use a small amount around the eye area.",icon:"eye"},{title:"Complete",body:"Avoid direct eye contact. Finish your usual routine.",icon:"layers"}]
  },
  "anti-aging-cleanser-with-peptides": {
    texture:"Daily cleanser / fine lather",
    benefits:[{title:"Daily cleansing",body:"Massage onto damp skin to lift buildup.",icon:"rinse"},{title:"Comfort in focus",body:"Glycerin and panthenol condition the skin.",icon:"feather"},{title:"Peptide support",body:"A peptide component in a rinse-off formula.",icon:"layers"},{title:"A fresh start",body:"Prepare for your serum and moisturizer.",icon:"droplet"}],
    ingredients:[{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Moisture-focused care for a comfortable skin feel.",tags:["HUMECTANT","COMFORT"]},{art:"panthenol",artLabel:"Panthenol / provitamin B5",kind:"molecule",summary:"Conditioning care that complements glycerin.",tags:["PROVITAMIN B5","CONDITIONING"]},{art:"palmitoyl-tripeptide",artLabel:"Palmitoyl tripeptide-1",kind:"molecule",summary:"Palmitoyl tripeptide-1 and tetrapeptide-7 support the formula.",tags:["PEPTIDE CARE","RINSE-OFF FORMULA"]}],
    routineTitle:"The first step, done well.",timing:"AM + PM / RINSE OFF",
    steps:[{title:"Dampen",body:"Begin with pre-moistened skin.",icon:"cleanse"},{title:"Massage",body:"Gently work a small amount over the skin.",icon:"apply"},{title:"Rinse",body:"Rinse thoroughly, then continue your routine.",icon:"layers"}]
  }
};
