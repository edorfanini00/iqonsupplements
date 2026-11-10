import type { SkincareStory } from './skincare-stories';
import type { SkinVisualContent } from './skincare-visual-content';
import type { ProductPresentation } from './product-presentation';
import type { GalleryGuide } from './product-gallery-content';
// Only the three new formulas. Existing seven records remain untouched.
export const newSkincareStories: Record<string,SkincareStory> = {"enzyme-gel-cleanser": {
    eyebrow:"THE FIRST STEP",title:"Start clean. Finish smooth.",
    introduction:"A rinse-off gel cleanser with papaya fruit extract, salicylic acid and glycerin. Massage onto damp skin, rinse well and move on to the rest of your routine.",
    imageAlt:"Texture image pending approval — local preview only",photoCaption:"A small amount. Damp skin. A thorough rinse.",
    benefits:[{title:"A rinse-off gel",body:"Massage onto damp skin as the first step of your morning or evening routine."},{title:"Papaya + salicylic acid",body:"Papaya fruit extract and salicylic acid sit alongside glycerin in the cleansing gel."},{title:"Prepare for what follows",body:"Rinse well, then continue with your serum and moisturizer."}],
    facts:[{value:"01",label:"The first step",detail:"Begin with cleansing."},{value:"207 mL",label:"Gel cleanser",detail:"7 fl oz, a rinse-off facial formula."},{value:"AM / PM",label:"Up to twice daily",detail:"Massage onto damp skin, then rinse."}],
    formulaTitle:"A gel cleanse, with papaya.",formulaIntro:"A rinse-off formula that brings papaya fruit extract and salicylic acid into your first skincare step.",
    perspective:{eyebrow:"RINSE-OFF + LEAVE-ON",title:"Give each step its own job.",body:"The cleanser is massaged onto damp skin and rinsed away. It starts the routine; your serum and moisturizer are the leave-on steps that follow.",points:[{title:"During cleansing",body:"Papaya fruit extract and salicylic acid are part of the gel."},{title:"After rinsing",body:"Continue with a hydration or treatment step suited to your skin."}]},
    routineIntro:"A straightforward first step, up to twice daily. Use a small amount on damp skin and rinse well with water.",routineNote:"Contains salicylic acid and orange peel oil. If you use other exfoliating or retinoid products, introduce new steps one at a time and stop use if irritation occurs."
  },
"hyaluronic-serum": {
    eyebrow:"LIGHTWEIGHT HYDRATION",title:"Hydration, in a lighter layer.",
    introduction:"An aloe-based serum with glycerin, panthenol and sodium hyaluronate, for skin that feels dehydrated. Apply after cleansing and before moisturizer.",
    imageAlt:"Texture image pending approval — local preview only",photoCaption:"A light layer, before your moisturizer.",
    benefits:[{title:"For dehydrated-feeling skin",body:"Humectants attract and hold water in a lightweight serum."},{title:"An aloe-based formula",body:"Aloe leaf comes straight after water, with glycerin and panthenol."},{title:"Layers before cream",body:"Once absorbed, follow with moisturizer and SPF by day."}],
    facts:[{value:"30 mL",label:"Serum format",detail:"1 fl oz, for the face and neck."},{value:"AM / PM",label:"Up to twice daily",detail:"After cleansing and toning."},{value:"02",label:"Humectants",detail:"Glycerin and sodium hyaluronate."}],
    formulaTitle:"Water-binding care, kept light.",formulaIntro:"Humectants and conditioning ingredients share this hydration step.",
    perspective:{eyebrow:"WHAT A HYDRATING SERUM DOES",title:"Hydration has a place before cream.",body:"A light hydrating layer and a richer moisturizer serve different purposes. This serum adds water-binding ingredients before your cream.",points:[{title:"Humectants",body:"Glycerin and sodium hyaluronate attract and hold water."},{title:"Your next step",body:"Follow with moisturizer, and SPF in the morning."}]},
    routineIntro:"Apply to the entire face and neck after cleansing and toning. Let it absorb before moisturizer.",routineNote:"Contains the color additives Yellow 5 and Blue 1 and the preservative methylisothiazolinone. Stop use if irritation occurs."
  },
"peptide-anti-wrinkle-day-cream": {
    eyebrow:"YOUR MORNING CREAM",title:"A richer start to the day.",
    introduction:"A rich day cream for dull, dry-feeling skin, with aloe, sodium hyaluronate, panthenol and squalane. Massage in each morning, then follow with sun protection.",
    imageAlt:"Texture image pending approval — local preview only",photoCaption:"Warm a small amount between your fingertips.",
    benefits:[{title:"Moisture for dry-feeling skin",body:"Aloe, glycerin and sodium hyaluronate bring water-binding care."},{title:"A softer feel",body:"Squalane and cetyl esters help skin feel soft and look smoother."},{title:"Made for mornings",body:"Face, neck and décolleté, then sun protection."}],
    facts:[{value:"AM",label:"Morning care",detail:"Follow with SPF."},{value:"50 mL",label:"Cream format",detail:"1.7 fl oz, for face, neck and décolleté."},{value:"SPF",label:"Your daytime partner",detail:"Sun protection completes the step."}],
    formulaTitle:"Humectants. Emollients. A rich finish.",formulaIntro:"Water-binding and softening ingredients play different roles within the same cream.",
    perspective:{eyebrow:"UNDERSTAND YOUR MOISTURIZER",title:"Water binding and softness are different jobs.",body:"A moisturizer can include ingredients that attract water and ingredients that soften the skin. This cream brings both together for the morning.",points:[{title:"Humectants",body:"Glycerin and sodium hyaluronate attract and hold water."},{title:"Emollient care",body:"Squalane and cetyl esters add softness."}]},
    routineIntro:"Apply each morning after cleansing and any serum, then follow with sun protection.",routineNote:"Contains fragrance, hydrolyzed wheat protein and retinyl palmitate, a vitamin A ester. Consider your other vitamin A products and stop use if irritation occurs."
  }};
export const newSkincareVisualContent: Record<string,SkinVisualContent> = {"enzyme-gel-cleanser": {
    photoLabel:"THE CLEANSE", ingredientOrder:[0,1,2], routineEyebrow:"YOUR FIRST STEP", timingIcon:"day-night",
    texture:"Rinse-off gel / AM + PM",
    benefits:[{title:"A rinse-off gel",body:"Massage onto damp skin, then rinse well.",icon:"rinse"},{title:"Papaya fruit extract",body:"Papaya fruit extract is listed in the formula.",icon:"spark"},{title:"Salicylic acid",body:"A beta hydroxy acid in the cleansing gel.",icon:"layers"},{title:"Ready for what follows",body:"Clean skin before serum and moisturizer.",icon:"face"}],
    ingredients:[{label:"Papaya fruit extract",art:"botanical",artLabel:"Carica papaya fruit extract",kind:"botanical",summary:"The label names Carica Papaya (Papaya) Fruit Extract.",tags:["BOTANICAL","PAPAYA"]},{art:"salicylic-acid",artLabel:"Salicylic acid / BHA",kind:"molecule",summary:"A beta hydroxy acid, rinsed away with the gel.",tags:["BHA","RINSE-OFF"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"A humectant alongside the cleansing ingredients.",tags:["HUMECTANT","COMFORT"]}],
    routineTitle:"Dampen. Massage. Rinse.",timing:"AM + PM / FIRST STEP",
    steps:[{title:"Dampen skin",body:"Begin with damp skin.",icon:"cleanse"},{title:"Massage gently",body:"Work a small amount over the face.",icon:"apply"},{title:"Rinse well",body:"Rinse with water, then continue your routine.",icon:"layers"}]
  },
"hyaluronic-serum": {
    photoLabel:"THE APPLICATION", ingredientOrder:[0,1,2], routineEyebrow:"YOUR HYDRATION STEP", timingIcon:"layers",
    texture:"Lightweight serum / before moisturizer",
    benefits:[{title:"Light hydration",body:"For skin that feels dehydrated.",icon:"droplet"},{title:"Two humectants",body:"Glycerin and sodium hyaluronate hold water.",icon:"layers"},{title:"Aloe-based",body:"Aloe leaf, panthenol and allantoin condition.",icon:"feather"},{title:"Twice-daily step",body:"After cleansing and toning, before cream.",icon:"face"}],
    ingredients:[{label:"Sodium hyaluronate",art:"moisture",artLabel:"Moisture binding",kind:"moisture",summary:"The salt form of hyaluronic acid, binding water at the surface.",tags:["HUMECTANT","HYDRATION"]},{art:"glycerin",artLabel:"Glycerin",kind:"molecule",summary:"A second humectant that attracts water.",tags:["HUMECTANT","LIGHT LAYER"]},{label:"Aloe + panthenol",art:"panthenol",artLabel:"Panthenol / provitamin B5",kind:"molecule",summary:"Conditioning care in an aloe-based serum.",tags:["ALOE","CONDITIONING"]}],
    routineTitle:"Apply. Absorb. Moisturize.",timing:"AM + PM / BEFORE MOISTURIZER",
    steps:[{title:"Cleanse + tone",body:"Start with clean skin.",icon:"cleanse"},{title:"Apply",body:"Smooth over the face and neck.",icon:"apply"},{title:"Moisturize + SPF",body:"Follow with cream; SPF by day.",icon:"sun"}]
  },
"peptide-anti-wrinkle-day-cream": {
    photoLabel:"THE APPLICATION", ingredientOrder:[0,1,2], routineEyebrow:"YOUR MORNING STEP", timingIcon:"layers",
    texture:"Rich cream / mornings, before SPF",
    benefits:[{title:"Morning moisture",body:"A rich cream for dry-feeling skin.",icon:"droplet"},{title:"Softer-feeling skin",body:"Squalane and cetyl esters soften.",icon:"feather"},{title:"For dull-looking skin",body:"A rich cream for skin that looks dull and feels dry.",icon:"face"},{title:"Then sun protection",body:"Follow with SPF in the morning.",icon:"sun"}],
    ingredients:[{label:"Aloe leaf",art:"botanical",artLabel:"Aloe barbadensis leaf",kind:"botanical",summary:"Listed straight after water as the cream’s base.",tags:["BOTANICAL","BASE"]},{label:"Hyaluronate + glycerin",art:"moisture",artLabel:"Moisture binding",kind:"moisture",summary:"Two humectants that attract and hold water.",tags:["HUMECTANTS","HYDRATION"]},{art:"squalane",artLabel:"Squalane",kind:"molecule",summary:"An emollient that softens the feel of skin.",tags:["EMOLLIENT","SOFTNESS"]}],
    routineTitle:"Warm. Massage. Protect.",timing:"AM / BEFORE SPF",
    steps:[{title:"After serum",body:"Start with clean skin and any serum.",icon:"cleanse"},{title:"Warm + massage",body:"Face, neck and décolleté.",icon:"apply"},{title:"Protect",body:"Follow with sun protection (SPF).",icon:"sun"}]
  }};
export const newSkincarePresentation: Record<string,ProductPresentation> = {'enzyme-gel-cleanser': {
    kicker:'THE FIRST STEP',title:'A clean start. A smooth finish.',fact:'207 mL',factLabel:'rinse-off gel cleanser',diagram:'pair',labels:['Papaya fruit extract','Salicylic acid · BHA','Glycerin · humectant'],note:'7 fl oz. For daily cleansing, up to twice daily.',
    focus:{eyebrow:'RINSE-OFF VS. LEAVE-ON',title:'Give each step its own job.',body:'This cleanser starts the routine and is rinsed away. Your serum and moisturizer remain on the skin afterwards.',layout:'compare',rows:[{label:'RINSE OFF',value:'Cleanse',detail:'Massage onto damp skin and rinse well with water.'},{label:'LEAVE ON',value:'Treat + moisturize',detail:'Apply your selected serum and moisturizer after cleansing. Finish with SPF by day.'}]}
  },
'hyaluronic-serum': {
    kicker:'A LIGHT HYDRATION LAYER',title:'Hydration without the weight.',fact:'30 mL',factLabel:'lightweight serum',diagram:'pair',labels:['Sodium hyaluronate · humectant','Glycerin · humectant','Aloe + panthenol · conditioning'],note:'For skin that feels dehydrated. Before moisturizer.',
    focus:{eyebrow:'HYDRATE, THEN MOISTURIZE',title:'Two steps, two jobs.',body:'A hydrating serum and a moisturizer can work together. The serum adds water-binding ingredients; the cream follows.',layout:'compare',rows:[{label:'SERUM',value:'Add hydration',detail:'Glycerin and sodium hyaluronate in a light layer.'},{label:'MOISTURIZER',value:'Seal in comfort',detail:'Follow with your cream, and SPF in the morning.'}]}
  },
'peptide-anti-wrinkle-day-cream': {
    kicker:'YOUR MORNING CREAM',title:'Morning moisture, then SPF.',fact:'50 mL',factLabel:'rich day cream',diagram:'pair',labels:['Aloe · base','Hyaluronate + glycerin · hydration','Squalane · softness'],note:'Massage into face, neck and décolleté. Follow with SPF.',
    focus:{eyebrow:'UNDERSTAND YOUR MOISTURIZER',title:'Water binding and softness.',body:'Humectants attract water; emollients soften. This cream brings both together for the morning.',layout:'compare',rows:[{label:'HUMECTANTS',value:'Hyaluronate + glycerin',detail:'Attract and hold water.'},{label:'EMOLLIENTS',value:'Squalane + cetyl esters',detail:'Help skin feel soft. Follow with sun protection.'}]}
  }};
export const newSkincareGalleryGuides: Record<string,GalleryGuide> = {"enzyme-gel-cleanser": {
    eyebrow: "THE FIRST STEP", title: "Cleanse.\nThen continue.", design: "routine", main: "01", unit: "rinse-off gel",
    items: [{value:"Dampen",label:"Massage a small amount onto damp skin"},{value:"Rinse",label:"Rinse well, then continue your routine"}], note: "May be used twice daily. Papaya fruit extract, salicylic acid and glycerin."
  },
"hyaluronic-serum": {
    eyebrow: "WHERE IT FITS", title: "A light layer.\nBefore your cream.", design: "routine", main: "02", unit: "after cleansing",
    items: [{value:"Apply",label:"Face and neck, after cleansing and toning"},{value:"Moisturize",label:"Once absorbed, follow with cream and SPF"}], note: "May be used twice daily."
  },
"peptide-anti-wrinkle-day-cream": {
    eyebrow: "PLAN YOUR MORNING", title: "Moisturize.\nThen protect.", design: "daynight", main: "AM", unit: "morning cream",
    items: [{value:"AM",label:"Massage into face, neck and décolleté"},{value:"SPF",label:"Follow with sun protection"}], note: "Warm a small amount between your fingertips before applying."
  }};
