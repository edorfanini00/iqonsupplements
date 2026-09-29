import type { IngredientVisual } from "./skincare-visual-content";

type BenefitIcon = "strength" | "powder" | "drop" | "leaf" | "layers" | "capsule" | "clock" | "measure" | "spark" | "flask";
export type SupplementVisualContent = {
  eyebrow: string; title: string; introduction: string;
  photoLabel: string; photoCaption: string; imageAlt: string;
  benefits: {title:string;body:string;icon:BenefitIcon}[];
  formulaTitle: string; ingredients: IngredientVisual[];
  facts: {value:string;label:string;detail:string}[];
  composition?: {percent:number;label:string;total:string;note:string};
  routineTitle: string; timing:string; routineNote:string;
  stepIcons:[BenefitIcon,BenefitIcon,BenefitIcon];
};

const molecule=(art:string,artLabel:string,summary:string,tags:string[],label?:string):IngredientVisual=>({art,artLabel,summary,tags,label,kind:"molecule",imageSrc:`/images/supplement-ingredients/${art}.svg`});
const illustration=(art:string,artLabel:string,summary:string,tags:string[],label?:string):IngredientVisual=>({art,artLabel,summary,tags,label,kind:"illustration",imageSrc:`/images/supplement-ingredients/${art}.svg`});

/** Product facts come from supplement-details.ts. Artwork illustrates format or composition,
 * never a measured product outcome. Separate research retains its own scope and sources. */
export const supplementVisualContent:Record<string,SupplementVisualContent>={
  "creatine-monohydrate":{
    eyebrow:"CREATINE / REPEATED EFFORT",title:"Put more into every effort.",
    introduction:"For the short, demanding moments in your training. A single-ingredient creatine powder for the muscle energy system used in lifting, sprinting and repeated high-intensity exercise.*",
    photoLabel:"THE POWDER DETAIL",photoCaption:"Fine powder / single ingredient",imageAlt:"Fine white powder in a brushed stainless-steel scoop on a cool charcoal surface",
    benefits:[{title:"Muscle energy",body:"Creatine helps replenish ATP during brief, intense efforts.*",icon:"strength"},{title:"One ingredient",body:"Only creatine monohydrate. A straightforward formula.",icon:"flask"},{title:"Unflavored",body:"Mix into water or juice, with no added sweetener.",icon:"drop"},{title:"Made for a routine",body:"Distinct loading and maintenance phases on the label.",icon:"clock"}],
    formulaTitle:"One ingredient. A clear purpose.",ingredients:[molecule("creatine-monohydrate","Creatine monohydrate","The researched monohydrate form, in an unflavored powder.",["MONOHYDRATE","MUSCLE ENERGY"])],
    facts:[{value:"01",label:"Ingredient",detail:"Creatine monohydrate is the complete ingredient statement."},{value:"281 g",label:"Powder per jar",detail:"Use the supplied scoop and follow the product directions."},{value:"Unflavored",label:"Nothing to sweeten",detail:"No flavor, caffeine or sweetener is listed in the formula."}],
    routineTitle:"A simple training-day habit.",timing:"LOADING → MAINTENANCE",routineNote:"The label specifies one scoop four times daily for the first five days, then one or two times daily. Mix each scoop with 8 oz of water or juice; follow the complete directions.",stepIcons:["measure","drop","clock"]
  },
  "hydrolyzed-collagen-peptides":{
    eyebrow:"COLLAGEN / YOUR EVERYDAY DRINK",title:"Your drink. Your collagen ritual.",
    introduction:"Keep the drink you enjoy. Add a single ingredient: bovine hide collagen peptides. Unflavored and without added sweeteners, this powder fits around your preferences.",
    photoLabel:"THE MIXING DETAIL",photoCaption:"Unflavored / your daily drink",imageAlt:"Unflavored powder falling into a clear glass of water with a softly clouded surface",
    benefits:[{title:"Peptides, simply",body:"Hydrolyzed collagen is broken down into smaller peptides.",icon:"layers"},{title:"Only collagen",body:"Bovine hide collagen peptides, with nothing else added.",icon:"flask"},{title:"Keep your flavor",body:"No added flavor or sweetener changes your chosen drink.",icon:"drop"},{title:"One level scoop",body:"A daily serving mixed into a chilled beverage.",icon:"measure"}],
    formulaTitle:"Collagen. Nothing added.",ingredients:[illustration("collagen-peptides","Hydrolyzed collagen peptides","Bovine collagen broken into smaller peptide chains.",["BOVINE SOURCE","SINGLE INGREDIENT"])],
    facts:[{value:"01",label:"Ingredient",detail:"Bovine hide collagen peptides form the whole formula."},{value:"280 g",label:"Powder per jar",detail:"One level scoop in 8–10 oz of a chilled drink."},{value:"Unflavored",label:"Make it yours",detail:"Choose this formula when you prefer to keep your drink’s own flavor."}],
    routineTitle:"Scoop. Shake. Make it yours.",timing:"ONE SHAKE DAILY",routineNote:"Use a level scoop and a shaker cup. The chocolate formula has a different ingredient list and a two-scoop preparation.",stepIcons:["measure","drop","clock"]
  },
  "collagen-peptides-chocolate":{
    eyebrow:"COLLAGEN / THE CHOCOLATE FORMULA",title:"A richer daily collagen ritual.",
    introduction:"Bovine collagen peptides with cocoa, natural flavor and stevia. A chocolate blend for people who want their collagen drink to bring its own character.",
    photoLabel:"THE CHOCOLATE TEXTURE",photoCaption:"Chocolate / mix into your ritual",imageAlt:"Top view of a chocolate-colored drink in a glass with a subtle swirl and small natural bubbles",
    benefits:[{title:"Collagen foundation",body:"Hydrolyzed bovine hide collagen forms the base.",icon:"layers"},{title:"Chocolate character",body:"Cocoa and natural flavor shape the finished drink.",icon:"spark"},{title:"Stevia sweetness",body:"Stevia extract complements the cocoa flavor.",icon:"leaf"},{title:"Shake or blend",body:"Two scoops in your preferred beverage.",icon:"drop"}],
    formulaTitle:"Collagen at the heart of the blend.",ingredients:[illustration("collagen-peptides","Hydrolyzed collagen peptides","The bovine collagen foundation of the chocolate blend.",["BOVINE SOURCE","HYDROLYZED"],"Collagen peptides"),illustration("flavor-blend","Cocoa + natural flavor","The ingredients that give the drink its chocolate character.",["COCOA","CHOCOLATE FLAVOR"]),illustration("stevia-leaf","Stevia extract","A plant-derived sweetener that complements the cocoa.",["STEVIA EXTRACT","SWEETNESS"])],
    facts:[{value:"378 g",label:"Powder per jar",detail:"Chocolate-flavored collagen blend."},{value:"2 scoops",label:"Suggested preparation",detail:"Mix in a shaker cup or blender."},{value:"8–10 oz",label:"Your preferred beverage",detail:"Combine with the full two-scoop serving."}],
    routineTitle:"Give your shake some character.",timing:"SHAKER CUP OR BLENDER",routineNote:"This is a flavored blend. For collagen without cocoa, flavor or sweetener, explore the single-ingredient unflavored powder below.",stepIcons:["measure","drop","spark"]
  },
  "colostrum-powder":{
    eyebrow:"COLOSTRUM / COMPOSITION, CLEARLY",title:"Know what’s in your scoop.",
    introduction:"A measured bovine colostrum formula with a clearly stated IgG content. One scoop, mixed cold, makes the serving easy to understand and prepare.",
    photoLabel:"THE COLOSTRUM TEXTURE",photoCaption:"Ivory powder / mix cold",imageAlt:"Pale ivory powder in a frosted glass dish with a small silver spoon",
    benefits:[{title:"2,300 mg colostrum",body:"The total bovine colostrum amount per serving.",icon:"measure"},{title:"25% IgG",body:"575 mg of IgG is included within that total.",icon:"flask"},{title:"Milk-derived",body:"Bovine colostrum is a dairy ingredient.",icon:"layers"},{title:"Mix it cold",body:"Enjoy within ten minutes of preparing.",icon:"drop"}],
    formulaTitle:"The amount. The protein within.",ingredients:[illustration("colostrum-composition","Bovine colostrum composition","A 2,300 mg serving, standardized to 25% IgG.",["BOVINE SOURCE","MILK-DERIVED"]),illustration("immunoglobulin","Immunoglobulin G / schematic","575 mg of naturally present IgG within each serving.",["25% IgG","WITHIN THE TOTAL"],"Immunoglobulin G")],
    facts:[{value:"2,300 mg",label:"Colostrum per serving",detail:"The total amount, including IgG."},{value:"575 mg",label:"IgG within the serving",detail:"Not an additional dose."},{value:"69 g",label:"Powder per jar",detail:"Milk-derived bovine colostrum."}],
    composition:{percent:25,label:"IgG",total:"2,300 mg bovine colostrum",note:"575 mg IgG is part of the total serving. The percentage describes composition, not a measured health result."},
    routineTitle:"One scoop. Freshly mixed.",timing:"COLD DRINK / WITHIN 10 MINUTES",routineNote:"Derived from milk. Consider milk allergy before choosing this formula. Use cold water or a favorite beverage and consume promptly.",stepIcons:["measure","drop","clock"]
  },
  "colon-gentle-cleanse":{
    eyebrow:"FIBER / A FRESHLY MIXED ROUTINE",title:"Fiber starts with water.",
    introduction:"Psyllium husk, four named enzymes, ginger and tamarind in individual sachets. Prepare each one when you need it: the fiber absorbs water and becomes gel-like.",
    photoLabel:"THE SACHET FORMAT",photoCaption:"One sachet / freshly mixed",imageAlt:"An open plain sachet beside a clear glass of water on a blue-gray surface",
    benefits:[{title:"Psyllium fiber",body:"A water-absorbing plant fiber at the center of the formula.",icon:"layers"},{title:"Four enzymes",body:"Amylase, lactase, lipase and cellulase.",icon:"flask"},{title:"Botanical partners",body:"Ginger root and tamarind fruit extract complete the blend.",icon:"leaf"},{title:"Individual sachets",body:"30 sachets, ready to mix one at a time.",icon:"measure"}],
    formulaTitle:"Fiber, enzymes and botanicals.",ingredients:[illustration("psyllium-fiber","Psyllium + water / schematic","Plant fiber that takes up water and becomes gel-like.",["PSYLLIUM HUSK","MIX WITH WATER"]),illustration("four-enzymes","Four-enzyme blend","Amylase, lactase, lipase and cellulase from fermented cereals.",["FOUR ENZYMES","FERMENTED-CEREAL BLEND"],"Enzyme blend"),illustration("botanical-pair","Ginger + tamarind","Two botanical ingredients alongside the psyllium.",["GINGER ROOT","TAMARIND EXTRACT"])],
    facts:[{value:"30",label:"Sachets per box",detail:"Use once or twice daily as directed."},{value:"200 mL",label:"Still water per sachet",detail:"Stir well and drink immediately."},{value:"2 hours",label:"After medication",detail:"Keep the interval specified on the label."}],
    routineTitle:"Mix fresh. Drink straight away.",timing:"SEPARATE FROM MEALS",routineNote:"Use the full 200 mL of still water. Drink immediately and take no earlier than two hours after medication. A gel-like texture is characteristic of this preparation.",stepIcons:["drop","clock","clock"]
  },
  "keto-5":{
    eyebrow:"KETO-5 / FIVE-PART BLEND",title:"Five ingredients. One clear routine.",
    introduction:"Raspberry ketone, green tea, caffeine anhydrous, green coffee bean and garcinia cambogia in a vegetable capsule. Get to know the full blend before adding it to your day.",
    photoLabel:"THE CAPSULE FORMAT",photoCaption:"Capsule format / with water",imageAlt:"Ivory two-piece capsules on a cool gray ceramic surface in soft daylight",
    benefits:[{title:"Five-part blend",body:"Four plant ingredients together with caffeine anhydrous.",icon:"layers"},{title:"Vegetable capsule",body:"A cellulose capsule shell for a vegan formula.",icon:"capsule"},{title:"Before meals",body:"One capsule twice daily, following the label.",icon:"clock"},{title:"60 capsules",body:"A 30-day supply at the suggested daily use.",icon:"measure"}],
    formulaTitle:"Get to know the Keto Blend.",ingredients:[molecule("caffeine","Caffeine","Caffeine anhydrous is one of the named blend ingredients.",["CONTAINS CAFFEINE","AMOUNT NOT LISTED"]),illustration("botanical-pair","Tea + coffee ingredients","Green tea and green coffee bean can also contribute caffeine.",["GREEN TEA","GREEN COFFEE"],"Tea + coffee bean"),illustration("botanical-blend","Raspberry ketone + garcinia","The remaining ingredients in the five-part blend.",["RASPBERRY KETONE","GARCINIA"],"Raspberry ketone + garcinia")],
    facts:[{value:"5",label:"Blend ingredients",detail:"See the complete ingredient statement."},{value:"60",label:"Vegetable capsules",detail:"One capsule, twice daily."},{value:"30 days",label:"At suggested use",detail:"Based on two capsules per day."}],
    routineTitle:"Make room for the full picture.",timing:"20–30 MINUTES BEFORE A MEAL",routineNote:"Contains caffeine; the total amount is not disclosed. Consider coffee, tea and other caffeinated supplements in your routine. The formula is not evidence of a weight-loss or ketosis outcome.",stepIcons:["flask","drop","clock"]
  },
  "glp-1-support":{
    eyebrow:"DAILY NUTRITION / A BROADER FORMULA",title:"More detail in your daily support.",
    introduction:"A combination of vitamins, minerals, botanical ingredients, enzymes and LactoSpore®. Explore what each part contributes, with the listed ingredient amounts in one place.",
    photoLabel:"THE DAILY FORMAT",photoCaption:"Two capsules / a daily routine",imageAlt:"Two ivory capsules on a brushed steel tray beside the cropped edge of a water glass",
    benefits:[{title:"Vitamins + minerals",body:"D3, B vitamins, magnesium, iron and zinc in the formula.",icon:"spark"},{title:"Digestive blend",body:"Ginger, peppermint, bromelain and DigeZyme®.",icon:"leaf"},{title:"LactoSpore®",body:"Bacillus coagulans is the probiotic ingredient.",icon:"flask"},{title:"Two daily capsules",body:"60 capsules provide 30 days at suggested use.",icon:"capsule"}],
    formulaTitle:"Explore the parts of the formula.",ingredients:[illustration("digestive-blend","Botanicals + enzymes","A 325 mg blend of ginger, peppermint and enzymes.",["325 mg BLEND","FOUR COMPONENTS"],"Digestive blend"),illustration("bacillus","Bacillus coagulans / schematic","166 mg of LactoSpore®; the label does not provide a CFU count.",["LACTOSPORE®","166 mg"]),illustration("nutrient-grid","Vitamins + minerals","Named forms and listed amounts, from D3 to zinc.",["B VITAMINS","MINERALS"])],
    facts:[{value:"325 mg",label:"Digestive blend",detail:"The combined blend amount, not each component."},{value:"166 mg",label:"LactoSpore®",detail:"Ingredient weight; a CFU count is not listed."},{value:"60",label:"Capsules per bottle",detail:"Two capsules daily with water."}],
    routineTitle:"A considered daily addition.",timing:"TWO CAPSULES DAILY",routineNote:"Discuss suitability with your clinician if you use GLP-1 medication. This supplement does not replace medication or a varied diet. Contains iron; keep out of reach of children and read the complete cautions.",stepIcons:["flask","capsule","layers"]
  },
  "liver-support":{
    eyebrow:"BOTANICALS / THE COMPLETE BLEND",title:"Seven botanicals. One daily step.",
    introduction:"Milk thistle, turmeric, beet root, dandelion, artichoke, ginger and alfalfa, complemented by L-cysteine hydrochloride. A closer look at the ingredients behind the name.",
    photoLabel:"THE CAPSULE DETAIL",photoCaption:"Capsule detail / botanical blend",imageAlt:"Ivory capsules on a muted sage-gray frosted glass plate with soft natural shadows",
    benefits:[{title:"Seven botanicals",body:"A combination of plant powders and artichoke extract.",icon:"leaf"},{title:"Specified extract",body:"The artichoke extract is standardized to 5% cynarin.",icon:"flask"},{title:"L-cysteine, included",body:"An amino acid ingredient alongside the botanicals.",icon:"layers"},{title:"A daily format",body:"Two capsules with water. 30 days at suggested use.",icon:"capsule"}],
    formulaTitle:"A closer look at the botanical blend.",ingredients:[illustration("botanical-blend","Milk thistle + turmeric","Two of the seven botanicals in the full formula.",["BOTANICAL POWDERS","SEVEN PLANTS"]),illustration("artichoke-leaf","Artichoke extract","Standardized to 5% cynarin; the extract amount is not listed.",["ARTICHOKE","5% CYNARIN"]),molecule("l-cysteine-hydrochloride","L-cysteine hydrochloride","The amino acid ingredient that complements the plant blend.",["AMINO ACID","L-CYSTEINE"],"L-cysteine")],
    facts:[{value:"7",label:"Botanical ingredients",detail:"Listed individually in the ingredient statement."},{value:"5%",label:"Cynarin in artichoke extract",detail:"A composition percentage, not an extract dose."},{value:"60",label:"Capsules per bottle",detail:"Two capsules daily with water."}],
    routineTitle:"Make the daily step simple.",timing:"TWO CAPSULES DAILY",routineNote:"Review the ingredients with your healthcare professional if you take medication or have a medical condition. Follow the suggested use; a botanical blend does not replace medical care.",stepIcons:["flask","drop","clock"]
  },
  "nmn":{
    eyebrow:"NMN / A MEASURED DAILY SERVING",title:"A precise place in your routine.",
    introduction:"500 mg of β-NMN in one daily capsule. NMN is a precursor the body uses to make NAD+, a coenzyme involved in cellular energy metabolism.*",
    photoLabel:"THE ONE-CAPSULE FORMAT",photoCaption:"One capsule / once daily",imageAlt:"One white capsule on the edge of a brushed silver tray against a muted lavender-gray background",
    benefits:[{title:"500 mg NMN",body:"A clearly stated amount per serving.",icon:"measure"},{title:"NAD+ precursor",body:"NMN has a role in the body’s NAD+ pathway.*",icon:"flask"},{title:"Vegetable capsule",body:"An HPMC shell, with a vegan formula.",icon:"leaf"},{title:"Once daily",body:"30 capsules. No powder preparation needed.",icon:"clock"}],
    formulaTitle:"The ingredient. The daily format.",ingredients:[molecule("beta-nmn","β-Nicotinamide mononucleotide","500 mg of the NAD+ precursor per serving.*",["500 mg","β-NMN"],"β-NMN"),illustration("capsule-shell","HPMC capsule / schematic","Hypromellose forms the vegetable capsule shell.",["HPMC","VEGETABLE CAPSULE"])],
    facts:[{value:"500 mg",label:"β-NMN per serving",detail:"The listed active ingredient amount."},{value:"1 capsule",label:"Suggested daily use",detail:"Take with 6–8 oz of water."},{value:"30 days",label:"At suggested use",detail:"30 capsules per bottle."}],
    routineTitle:"One capsule. A familiar habit.",timing:"ONCE DAILY / WITH WATER",routineNote:"Follow the label and review suitability with your healthcare professional. Human NMN research remains specific to the preparations and populations studied.",stepIcons:["capsule","drop","clock"]
  },
  "resveratrol":{
    eyebrow:"RESVERATROL / A SPECIFIED PLANT COMPLEX",title:"Read beyond the headline amount.",
    introduction:"A Polygonum cuspidatum root complex with 50% trans-resveratrol. Understanding both the complex weight and its standardization gives you a clearer picture of the formula.",
    photoLabel:"THE VEGETABLE CAPSULE",photoCaption:"Vegetable capsules / twice daily",imageAlt:"Two ivory capsules resting diagonally on smoky mauve-gray glass in soft directional light",
    benefits:[{title:"600 mg complex",body:"The listed amount refers to the whole root complex.",icon:"measure"},{title:"50% trans-resveratrol",body:"The specified proportion within the complex.",icon:"flask"},{title:"Root-derived",body:"Sourced from Polygonum cuspidatum.",icon:"leaf"},{title:"Vegetable capsule",body:"One capsule twice daily, before a meal.",icon:"capsule"}],
    formulaTitle:"A complex with a clear specification.",ingredients:[illustration("root-complex","Polygonum cuspidatum root complex","600 mg refers to the root complex, not pure trans-resveratrol.",["ROOT-DERIVED","600 mg COMPLEX"],"Root complex"),molecule("trans-resveratrol","Trans-resveratrol","The specified form at 50% of the botanical complex.",["POLYPHENOL","50% STANDARDIZATION"]),illustration("capsule-shell","Hypromellose capsule / schematic","The vegetable material used for the capsule shell.",["HYPROMELLOSE","CAPSULE SHELL"])],
    facts:[{value:"600 mg",label:"Listed root complex",detail:"The full complex weight."},{value:"50%",label:"Trans-resveratrol",detail:"The specified proportion within that complex."},{value:"60",label:"Vegetable capsules",detail:"One capsule twice a day."}],
    composition:{percent:50,label:"trans-resveratrol",total:"600 mg root complex",note:"The 600 mg amount describes the whole complex. Its 50% standardization describes composition, not a measured health result."},
    routineTitle:"A simple before-meal step.",timing:"ONE CAPSULE / TWICE DAILY",routineNote:"Take 20–30 minutes before a meal, following the label or your healthcare professional’s directions. Human research does not establish a guaranteed outcome for this formula.",stepIcons:["capsule","clock","clock"]
  },
  "hair-skin-nails-gummies":{
    eyebrow:"DAILY NUTRIENTS / A CHEWABLE FORMAT",title:"Your daily nutrients, with a twist.",
    introduction:"Passion-fruit-flavored gummies with biotin, other vitamins, minerals and fish-derived collagen. A chewable way to bring a broader nutrient formula into your routine.",
    photoLabel:"THE GUMMY TEXTURE",photoCaption:"Passion-fruit flavor / chewable format",imageAlt:"Ruby-red translucent dome-shaped gummies with natural surface detail on a cool gray glass plate",
    benefits:[{title:"Biotin + B vitamins",body:"A nutrient combination beyond biotin alone.",icon:"spark"},{title:"Vitamins + minerals",body:"Vitamins A, C, D and E alongside zinc and iodine.",icon:"layers"},{title:"Passion-fruit flavor",body:"A pectin-based gummy, with fish-derived collagen.",icon:"drop"},{title:"Two gummies daily",body:"60 gummies provide 30 days at suggested use.",icon:"clock"}],
    formulaTitle:"More than biotin alone.",ingredients:[molecule("biotin","Biotin / vitamin B7","Biotin is paired with B6, B12, folate and pantothenic acid.",["BIOTIN","B VITAMINS"]),illustration("nutrient-grid","Vitamins + minerals","Vitamins A, C, D and E, plus zinc and iodine.",["VITAMINS","MINERALS"]),illustration("collagen-peptides","Fish-derived collagen / illustration","The collagen is fish-derived; the complete formula is not vegan.",["FISH-DERIVED","CONTAINS FISH"],"Fish-derived collagen")],
    facts:[{value:"2 gummies",label:"Suggested daily use",detail:"Do not exceed the suggested serving."},{value:"60",label:"Gummies per bottle",detail:"30 days at suggested daily use."},{value:"Passion fruit",label:"Flavor",detail:"Contains sugars and fish-derived collagen."}],
    routineTitle:"Two gummies. Once a day.",timing:"DAILY / FOLLOW SUGGESTED USE",routineNote:"Contains fish-derived collagen and sugars. Check ingredient suitability and overlap with other vitamin supplements. Keep out of reach of children.",stepIcons:["measure","flask","clock"]
  }
};
