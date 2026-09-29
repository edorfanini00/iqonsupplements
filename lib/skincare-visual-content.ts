/** Short-form editorial copy from the existing supplier-grounded product copy.
 * Molecules show the named ingredient, not finished-product efficacy. */
export type IngredientVisual = {
  art: string; artLabel: string; kind: "molecule" | "peptide" | "moisture" | "emollient" | "botanical" | "illustration";
  summary: string; tags: string[]; label?: string; imageSrc?: string;
};
export type SkinVisualContent = {
  texture: string; photoLabel: string;
  ingredientOrder: [number, number, number];
  routineEyebrow: string; timingIcon: "day-night" | "moon" | "layers";
  benefits: { title: string; body: string; icon: "droplet" | "layers" | "spark" | "face" | "moon" | "sun" | "feather" | "rinse" | "pad" }[];
  ingredients: IngredientVisual[];
  routineTitle: string; timing: string; steps: { title: string; body: string; icon: "cleanse" | "apply" | "sun" | "moon" | "layers" | "pad" | "eye" }[];
};
export const skincareVisualContent: Record<string, SkinVisualContent> = {
  "copper-peptide-restore-cream": {
    photoLabel:"THE CREAM TEXTURE", ingredientOrder:[0,1,2], routineEyebrow:"YOUR MOISTURIZING STEP", timingIcon:"layers",
    texture: "Rich cream / soft finish",
    benefits: [
      {title:"Multi-peptide care",body:"GHK-Cu with three supporting peptides.",icon:"layers"},
      {title:"Cushioned moisture",body:"Shea butter adds richness and softness.",icon:"feather"},
      {title:"Hydration, paired",body:"Glycerin and hyaluronate bind water alongside the emollients.",icon:"droplet"},
      {title:"A richer finish",body:"A moisturizing step for dry-feeling skin, after serum.",icon:"face"}
    ],
    ingredients: [
      {label:"Copper peptide blend",art:"copper-peptide",artLabel:"Copper tripeptide-1 / GHK-Cu",kind:"molecule",summary:"GHK-Cu joins three other peptides in a richer moisturizing step.",tags:["PEPTIDE CARE","FIRMER-LOOKING SKIN"]},
      {art:"emollient",artLabel:"Emollient care",kind:"emollient",summary:"A rich emollient that softens the feel of skin.",tags:["SOFTNESS","RICHER TEXTURE"]},
      {art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Water-binding ingredients complement the cream’s emollients.",tags:["HUMECTANTS","HYDRATION"]}
    ],
    routineTitle:"Finish with richer care.",timing:"AFTER YOUR SERUM",
    steps:[{title:"Prepare",body:"Cleanse, then apply your chosen serum.",icon:"cleanse"},{title:"Smooth",body:"Apply the cream to your face and neck.",icon:"apply"},{title:"Complete",body:"Account for other retinol products. Use SPF by day.",icon:"sun"}]
  },
  "retinol-rx": {
    photoLabel:"THE EVENING STEP", ingredientOrder:[0,1,2], routineEyebrow:"YOUR EVENING RITUAL", timingIcon:"moon",
    texture:"Evening serum / targeted care",
    benefits:[{title:"Refine texture",body:"For the appearance of uneven skin texture.",icon:"face"},{title:"Softer-looking lines",body:"Retinol care for the appearance of fine lines.",icon:"spark"},{title:"Encapsulated retinol",body:"A delivery system that protects retinol and releases it gradually.",icon:"layers"},{title:"Softness + hydration",body:"Squalane softens. Hyaluronate binds water.",icon:"droplet"}],
    ingredients:[{art:"retinol",artLabel:"Retinol",kind:"molecule",summary:"Encapsulated to help protect retinol and allow gradual release.",tags:["ENCAPSULATED","TEXTURE + FINE LINES"]},{art:"niacinamide",artLabel:"Niacinamide / vitamin B3",kind:"molecule",summary:"Vitamin B3 complements the retinol treatment.",tags:["VITAMIN B3","FORMULA SUPPORT"]},{label:"Squalane + hyaluronate",art:"squalane",artLabel:"Squalane",kind:"molecule",summary:"Emollient softness pairs with water-binding hydration.",tags:["SOFTNESS","MOISTURE"]}],
    routineTitle:"An evening ritual, at your pace.",timing:"PM / INTRODUCE GRADUALLY",
    steps:[{title:"Evening care",body:"Apply as directed in a simple evening routine.",icon:"moon"},{title:"Build gradually",body:"Adjust frequency to your skin’s tolerance.",icon:"layers"},{title:"Protect by day",body:"Use SPF 30 or higher during the day.",icon:"sun"}]
  },
  "hydra-c-ferulic-serum": {
    photoLabel:"THE SERUM TEXTURE", ingredientOrder:[0,1,2], routineEyebrow:"YOUR ANTIOXIDANT STEP", timingIcon:"day-night",
    texture:"Daily serum / lightweight hydration",
    benefits:[{title:"A brighter look",body:"Ascorbic acid care for a dull-looking complexion.",icon:"spark"},{title:"C + ferulic acid",body:"Two complementary antioxidants in one formula.",icon:"layers"},{title:"A hydration layer",body:"Sodium hyaluronate binds water.",icon:"droplet"},{title:"Before moisturizer",body:"A light serum layer for morning or evening.",icon:"sun"}],
    ingredients:[{art:"vitamin-c",artLabel:"Ascorbic acid / vitamin C",kind:"molecule",summary:"The vitamin C form in the serum, for antioxidant care and radiance.",tags:["ANTIOXIDANT","BRIGHTNESS"]},{art:"ferulic-acid",artLabel:"Ferulic acid",kind:"molecule",summary:"A complementary antioxidant that helps stabilize vitamin C.",tags:["ANTIOXIDANT PARTNER","FORMULA SUPPORT"]},{art:"moisture",artLabel:"Water-binding care",kind:"moisture",summary:"A humectant that adds hydration alongside the antioxidants.",tags:["HUMECTANT","HYDRATION"]}],
    routineTitle:"Your daily antioxidant step.",timing:"AM + PM / BEFORE MOISTURIZER",
    steps:[{title:"Prepare",body:"Cleanse and apply your tonic if you use one.",icon:"cleanse"},{title:"Apply",body:"Smooth a small amount over the face and neck.",icon:"apply"},{title:"Layer",body:"Follow with moisturizer and sunscreen by day.",icon:"sun"}]
  },
  "exfoliating-pads": {
    photoLabel:"THE PAD IN DETAIL", ingredientOrder:[0,1,2], routineEyebrow:"YOUR EXFOLIATION STEP", timingIcon:"moon",
    texture:"Pre-moistened pads / focused application",
    benefits:[{title:"Refined texture",body:"Surface exfoliation for uneven texture and dull-looking skin.",icon:"face"},{title:"Two acid families",body:"Mandelic and lactic AHAs, with salicylic BHA.",icon:"layers"},{title:"Targeted application",body:"Sweep over the areas you want to exfoliate.",icon:"feather"},{title:"Ready to use",body:"50 pre-moistened pads. Follow the label for frequency.",icon:"pad"}],
    ingredients:[{label:"Mandelic + lactic acids",art:"mandelic-acid",artLabel:"Mandelic acid / AHA",kind:"molecule",summary:"Two alpha hydroxy acids for surface exfoliation.",tags:["AHA","SURFACE TEXTURE"]},{art:"salicylic-acid",artLabel:"Salicylic acid / BHA",kind:"molecule",summary:"The beta hydroxy acid component for congested-looking skin.",tags:["BHA","TARGETED CARE"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Moisture-binding care alongside chamomile, licorice and green tea.",tags:["HUMECTANT","SUPPORTING BOTANICALS"]}],
    routineTitle:"Sweep. Refine. Follow with care.",timing:"PM / FOLLOW LABEL FREQUENCY",
    steps:[{title:"Cleanse first",body:"Begin with clean skin in your evening routine.",icon:"cleanse"},{title:"Sweep a pad",body:"Pass over your chosen areas, avoiding the eyes.",icon:"pad"},{title:"Care + protect",body:"Moisturize afterwards. Use sunscreen during the day.",icon:"sun"}]
  },
  "hydrating-tonic": {
    photoLabel:"A WATER-LIGHT LAYER", ingredientOrder:[1,0,2], routineEyebrow:"YOUR HYDRATION STEP", timingIcon:"day-night",
    texture:"Water-light tonic / fresh hydration",
    benefits:[{title:"Water-light hydration",body:"A fresh layer for dehydrated-feeling skin.",icon:"droplet"},{title:"Humectant pairing",body:"Glycerin and sodium PCA bind water.",icon:"layers"},{title:"Aloe-based care",body:"Aloe and panthenol bring conditioning to the tonic.",icon:"feather"},{title:"Easy to layer",body:"After your cleanser, before serum and cream.",icon:"rinse"}],
    ingredients:[{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"A water-attracting ingredient for a hydrated skin feel.",tags:["HUMECTANT","LIGHT HYDRATION"]},{art:"sodium-pca",artLabel:"Sodium PCA",kind:"molecule",summary:"Water-binding care that complements glycerin.",tags:["WATER BINDING","MOISTURE"]},{art:"panthenol",artLabel:"Panthenol / provitamin B5",kind:"molecule",summary:"Conditioning ingredients in a water-light formula.",tags:["CONDITIONING","LIGHTWEIGHT"]}],
    routineTitle:"A light layer before treatment.",timing:"AM + PM / AFTER CLEANSING",
    steps:[{title:"Cleanse",body:"Start with freshly cleansed, rinsed skin.",icon:"cleanse"},{title:"Sweep",body:"Use a cotton pad over the face and neck.",icon:"pad"},{title:"Continue",body:"Follow with your chosen serum and moisturizer.",icon:"layers"}]
  },
  "firming-peptide-eye-gel": {
    photoLabel:"THE GEL TEXTURE", ingredientOrder:[0,1,2], routineEyebrow:"YOUR EYE-CARE RITUAL", timingIcon:"day-night",
    texture:"Light gel / targeted eye care",
    benefits:[{title:"Smoother-looking skin",body:"Peptide care for visible fine lines around the eyes.",icon:"face"},{title:"A cooling gel",body:"A light, refreshing feel for the eye area.",icon:"feather"},{title:"Three-peptide blend",body:"Tripeptide-5, tripeptide-1 and tetrapeptide-7.",icon:"layers"},{title:"Moisture support",body:"Glycerin and sodium PCA add hydration.",icon:"droplet"}],
    ingredients:[{art:"palmitoyl-tripeptide",artLabel:"Palmitoyl tripeptide-1",kind:"molecule",summary:"Palmitoyl tripeptide-5, tripeptide-1 and tetrapeptide-7.",tags:["PEPTIDE CARE","EYE-AREA FOCUS"]},{label:"Aloe + cucumber water",art:"botanical",artLabel:"Botanical conditioning",kind:"botanical",summary:"Botanical conditioning complements the light gel texture.",tags:["ALOE + CUCUMBER WATER","CONDITIONING"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Water-binding humectants bring hydration to the eye step.",tags:["HUMECTANTS","LIGHT HYDRATION"]}],
    routineTitle:"A small amount. A gentle touch.",timing:"AM + PM / AFTER CLEANSING",
    steps:[{title:"Start clean",body:"Cleanse before applying this targeted eye step.",icon:"cleanse"},{title:"Pat gently",body:"Use a small amount around the eye area.",icon:"eye"},{title:"AM + PM",body:"Repeat morning and evening. Keep the gel out of your eyes.",icon:"layers"}]
  },
  "anti-aging-cleanser-with-peptides": {
    photoLabel:"THE CLEANSING STEP", ingredientOrder:[1,0,2], routineEyebrow:"YOUR CLEANSING RITUAL", timingIcon:"day-night",
    texture:"Daily cleanser / fine lather",
    benefits:[{title:"Lift daily buildup",body:"A rinse-off cleanse, morning and evening.",icon:"rinse"},{title:"Keep the comfort",body:"Glycerin and panthenol support a soft skin feel.",icon:"feather"},{title:"Peptides, included",body:"Two palmitoyl peptides complement the cleansing formula.",icon:"layers"},{title:"A clean first step",body:"Rinse thoroughly before tonic and leave-on care.",icon:"droplet"}],
    ingredients:[{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"Moisture-focused care for a comfortable skin feel.",tags:["HUMECTANT","COMFORT"]},{art:"panthenol",artLabel:"Panthenol / provitamin B5",kind:"molecule",summary:"Conditioning care that complements glycerin.",tags:["PROVITAMIN B5","CONDITIONING"]},{art:"palmitoyl-tripeptide",artLabel:"Palmitoyl tripeptide-1",kind:"molecule",summary:"Palmitoyl tripeptide-1 and tetrapeptide-7 support the formula.",tags:["PEPTIDE CARE","RINSE-OFF FORMULA"]}],
    routineTitle:"The first step, done well.",timing:"AM + PM / RINSE OFF",
    steps:[{title:"Dampen",body:"Moisten your face before applying the cleanser.",icon:"cleanse"},{title:"Massage",body:"Gently work a small amount over the skin.",icon:"apply"},{title:"Rinse",body:"Rinse thoroughly with water, then continue with leave-on care.",icon:"cleanse"}]
  }
};
