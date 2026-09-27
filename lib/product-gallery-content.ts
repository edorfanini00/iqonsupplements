/** Gallery art direction: approved packaging plus exact, readable information.
 * Amounts and directions are taken from the supplied product statements.
 * These graphics explain format and use; they do not depict clinical outcomes. */
export type GalleryGuide = {
  eyebrow: string;
  title: string;
  design: "mix" | "capsule" | "gummy" | "amounts" | "daynight" | "routine" | "pairing" | "eye";
  main: string;
  unit: string;
  items: { value: string; label: string }[];
  note: string;
};
export const galleryGuides: Record<string, GalleryGuide> = {
  "creatine-monohydrate": {
    eyebrow: "PREPARATION", title: "One scoop.\nStart with water.", design: "mix", main: "8", unit: "oz of water or juice",
    items: [{value:"01",label:"Measure a scoop"},{value:"02",label:"Mix thoroughly"}],
    note: "Frequency differs during loading and maintenance. Follow the full directions below."
  },
  "hydrolyzed-collagen-peptides": {
    eyebrow: "YOUR DAILY MIX", title: "A simple addition.\nNo added flavor.", design: "mix", main: "1", unit: "level scoop",
    items: [{value:"8–10 oz",label:"Chilled liquid"},{value:"5 sec",label:"Shake to mix"}], note: "Bovine hide collagen peptides. One ingredient, prepared your way."
  },
  "collagen-peptides-chocolate": {
    eyebrow: "THE CHOCOLATE ROUTINE", title: "Scoop.\nShake. Enjoy.", design: "mix", main: "2", unit: "scoops",
    items: [{value:"8–10 oz",label:"Your chosen beverage"},{value:"Shake",label:"Or use a blender"}], note: "Cocoa and natural flavor, sweetened with stevia extract."
  },
  "colostrum-powder": {
    eyebrow: "KEEP IT COLD", title: "Freshly mixed.\nSimply prepared.", design: "mix", main: "1", unit: "scoop",
    items: [{value:"6–8 oz",label:"Cold liquid"},{value:"10 min",label:"Consume within"}], note: "Bovine colostrum is milk-derived. Review the ingredient statement for suitability."
  },
  "colon-gentle-cleanse": {
    eyebrow: "THE FIBER FORMULA", title: "Fiber, with\nsupporting ingredients.", design: "amounts", main: "Psyllium", unit: "husk seed powder",
    items: [{value:"4 enzymes",label:"Amylase · lactase · lipase · cellulase"},{value:"2 botanicals",label:"Ginger root · tamarind fruit"}], note: "Use with the full 200 mL of water. Stir and drink immediately. Never take dry."
  },
  "keto-5": {
    eyebrow: "THE CAPSULE ROUTINE", title: "A measured step\nin your day.", design: "capsule", main: "1", unit: "capsule, twice daily",
    items: [{value:"60",label:"Capsules per bottle"},{value:"30",label:"Days at suggested use"}], note: "Contains caffeine. Account for coffee, tea and other caffeine sources."
  },
  "glp-1-support": {
    eyebrow: "SELECTED LABEL AMOUNTS", title: "See what\ngoes into your serving.", design: "amounts", main: "200 mg", unit: "magnesium",
    items: [{value:"325 mg",label:"Digestive Comfort & Soothing Blend"},{value:"166 mg",label:"LactoSpore® · listed by weight"}], note: "Selected amounts, not the complete formula. Review all nutrients and ingredients below."
  },
  "liver-support": {
    eyebrow: "THE DAILY FORMAT", title: "A botanical blend.\nA simple routine.", design: "capsule", main: "2", unit: "capsules daily",
    items: [{value:"6–8 oz",label:"Take with water"},{value:"60",label:"Capsules per bottle"}], note: "Milk thistle, turmeric and five more botanicals, alongside L-cysteine."
  },
  "nmn": {
    eyebrow: "YOUR DAILY FORMAT", title: "One capsule.\nOnce a day.", design: "capsule", main: "1", unit: "vegetable capsule daily",
    items: [{value:"30",label:"Capsules per bottle"},{value:"30",label:"Days at suggested use"}], note: "Take with 6–8 oz of water, following the label directions."
  },
  "resveratrol": {
    eyebrow: "SOURCE & FORM", title: "A named source.\nA specified form.", design: "pairing", main: "Root", unit: "Polygonum cuspidatum",
    items: [{value:"Botanical",label:"Root-derived complex"},{value:"Trans",label:"The specified resveratrol form"}], note: "The listed 600 mg refers to the complex. Read it alongside the 50% standardization."
  },
  "hair-skin-nails-gummies": {
    eyebrow: "THE CHEWABLE FORMAT", title: "Daily care.\nA different form.", design: "gummy", main: "2", unit: "gummies daily",
    items: [{value:"60",label:"Gummies per bottle"},{value:"30",label:"Days at suggested use"}], note: "Passion-fruit flavor. Contains sugars and fish-derived collagen."
  },
  "anti-aging-cleanser-with-peptides": {
    eyebrow: "THE FIRST STEP", title: "Cleanse.\nThen continue.", design: "routine", main: "01", unit: "rinse-off care",
    items: [{value:"Dampen",label:"Massage gently onto damp skin"},{value:"Rinse",label:"Follow with your leave-on care"}], note: "Use morning and evening. Glycerin and panthenol complement the peptide formula."
  },
  "hydrating-tonic": {
    eyebrow: "WHERE IT FITS", title: "A light layer.\nIn the right place.", design: "routine", main: "02", unit: "after cleansing",
    items: [{value:"Cleanse",label:"Begin with clean skin"},{value:"Hydrate",label:"Tonic, then serum and moisturizer"}], note: "Aloe, glycerin and sodium PCA. Sweep over the face and neck."
  },
  "exfoliating-pads": {
    eyebrow: "UNDERSTAND THE ACIDS", title: "Two families.\nOne considered step.", design: "pairing", main: "AHA / BHA", unit: "complementary exfoliants",
    items: [{value:"AHA",label:"Mandelic + lactic acids"},{value:"BHA",label:"Salicylic acid"}], note: "Introduce as directed. Plan other exfoliants and retinoids carefully, and use daily SPF."
  },
  "hydra-c-ferulic-serum": {
    eyebrow: "YOUR SERUM STEP", title: "Find your place.\nMorning or evening.", design: "daynight", main: "AM / PM", unit: "after cleansing",
    items: [{value:"AM",label:"Serum, moisturizer, then SPF"},{value:"PM",label:"Serum before moisturizer"}], note: "Apply to clean skin. Antioxidant care does not replace sunscreen."
  },
  "retinol-rx": {
    eyebrow: "PLAN YOUR ROUTINE", title: "Care by night.\nProtect by day.", design: "daynight", main: "PM / AM", unit: "two parts of your routine",
    items: [{value:"PM",label:"Introduce retinol gradually"},{value:"AM",label:"Use SPF 30 or higher"}], note: "Build frequency as tolerated. Follow the label and keep your other active steps in mind."
  },
  "firming-peptide-eye-gel": {
    eyebrow: "A TARGETED APPLICATION", title: "A small amount.\nA gentle touch.", design: "eye", main: "AM / PM", unit: "on clean skin",
    items: [{value:"Gently pat",label:"A small amount around the eye area"},{value:"AM / PM",label:"Morning and evening, on clean skin"}], note: "Keep the gel outside the eye. Avoid direct contact with eyes."
  },
  "copper-peptide-restore-cream": {
    eyebrow: "MORE THAN MOISTURE", title: "Water binding.\nEmollient comfort.", design: "pairing", main: "Two roles", unit: "within your moisturizer",
    items: [{value:"Hydration",label:"Glycerin + sodium hyaluronate"},{value:"Softness",label:"Shea butter"}], note: "Alongside the peptide blend. Also contains retinol; plan your other active steps."
  }
};

/** Distinct existing IQON photographs where they show the physical format clearly. */
export const galleryPhotographs: Record<string, {src:string; alt:string}> = {
  "creatine-monohydrate": {src:"/images/supplements/12_hero_creatine_scoop.webp",alt:"IQON Creatine Monohydrate jar, open with its scoop"},
  "collagen-peptides-chocolate": {src:"/images/supplements/13_hero_collagen_choc_scoop.webp",alt:"IQON Chocolate Collagen Peptides with a scoop of powder"},
  "colostrum-powder": {src:"/images/supplements/16_hero_colostrum_open.webp",alt:"Open IQON Colostrum Powder jar and scoop"},
  "colon-gentle-cleanse": {src:"/images/supplements/15_hero_colon_sachet.webp",alt:"IQON Colon Gentle Cleanse with its individual sachet format"},
  "liver-support": {src:"/images/supplements/11_hero_liver_capsules.webp",alt:"IQON Liver Support bottle and capsules"},
  "resveratrol": {src:"/images/supplements/18_hero_resveratrol_hardshadow.webp",alt:"IQON Resveratrol bottle in directional studio light"},
  "hair-skin-nails-gummies": {src:"/images/supplements/14_hero_gummies_falling.webp",alt:"IQON Hair, Skin and Nails Gummies bottle showing the chewable format"}
};
