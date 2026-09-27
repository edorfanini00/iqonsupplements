/** Original editorial content. Formula roles and directions are grounded in the
 * supplier specifications recorded in docs/product-story-research.md.
 * Campaign photography illustrates use; it is never presented as a customer result. */
export type SkincareStory = {
  eyebrow: string; title: string; introduction: string;
  imageAlt: string; photoCaption: string;
  benefits: {title:string;body:string}[];
  facts: {value:string;label:string;detail:string}[];
  formulaTitle:string; formulaIntro:string;
  perspective:{eyebrow:string;title:string;body:string;points:{title:string;body:string}[]};
  routineIntro:string; routineNote:string;
};
export const skincareStories:Record<string,SkincareStory> = {
  "retinol-rx": {
    eyebrow:"THE EVENING TREATMENT", title:"Make room for renewal.",
    introduction:"For visible lines and uneven texture. Encapsulated retinol takes the lead, with niacinamide, squalane and sodium hyaluronate supporting the formula.",
    imageAlt:"Evening skincare editorial: a woman gently touches her cheek",photoCaption:"An evening ritual, introduced at your skin’s pace.",
    benefits:[{title:"Refine the look of texture",body:"A targeted retinol step for skin that looks uneven, with care for the appearance of fine lines."},{title:"Consider the delivery",body:"Encapsulation helps protect retinol from light and oxygen and allows it to release gradually."},{title:"Keep moisture in the picture",body:"Squalane adds emollient softness. Sodium hyaluronate binds water alongside the treatment ingredients."}],
    facts:[{value:"PM",label:"Evening care",detail:"Introduce gradually, as tolerated."},{value:"30 mL",label:"Serum format",detail:"A treatment step before moisturizer."},{value:"SPF 30+",label:"Your daytime partner",detail:"Daily sun protection is part of the routine."}],
    formulaTitle:"Retinol at the center. Support around it.",formulaIntro:"The active ingredient is only part of the story. Delivery, conditioning and moisture each have a place in this formula.",
    perspective:{eyebrow:"UNDERSTAND THE FORMULA",title:"Delivery matters as much as the ingredient.",body:"Encapsulation encloses the retinol within a delivery system. The supporting ingredients have different jobs; they complement the treatment rather than replacing it.",points:[{title:"Inside the delivery system",body:"Retinol is protected from light and oxygen and released gradually."},{title:"Alongside the retinol",body:"Niacinamide, an emollient and a humectant round out the formula."}]},
    routineIntro:"Start with a simple evening routine. Give your skin time to adjust before increasing frequency.",routineNote:"Avoid during pregnancy or breastfeeding. Consider retinol in other products—including Copper Peptide Restore Cream—before layering. Do not continue through persistent irritation."
  },
  "hydra-c-ferulic-serum": {
    eyebrow:"BRIGHTNESS + HYDRATION",title:"A brighter outlook for your skin.",
    introduction:"Vitamin C and ferulic acid bring antioxidant care to dull-looking skin. Sodium hyaluronate adds hydration in the same serum step.",
    imageAlt:"Morning skincare editorial: a woman gently presses her cheek in soft daylight",photoCaption:"Antioxidant care with a place in your daily routine.",
    benefits:[{title:"Care for dull-looking skin",body:"Ascorbic acid is the vitamin C form in this formula, supporting a routine for a brighter-looking complexion."},{title:"Pair complementary antioxidants",body:"Ferulic acid sits alongside vitamin C, bringing another source of antioxidant care."},{title:"Add a layer of hydration",body:"Sodium hyaluronate binds water, bringing moisture to the skin alongside the antioxidant ingredients."}],
    facts:[{value:"C + F",label:"Antioxidant pairing",detail:"Ascorbic acid with ferulic acid."},{value:"30 mL",label:"Serum format",detail:"Apply to the face and neck."},{value:"AM / PM",label:"A daily step",detail:"Follow with moisturizer; SPF by day."}],
    formulaTitle:"Two antioxidants. A hydration partner.",formulaIntro:"Three key ingredients, with complementary roles in one daily serum.",
    perspective:{eyebrow:"THE PAIRING",title:"Brightness and hydration can share a step.",body:"This is more than a vitamin C story. The formula combines antioxidant ingredients with a humectant, giving treatment and hydration different but complementary roles.",points:[{title:"Antioxidant care",body:"Vitamin C and ferulic acid form the antioxidant pairing."},{title:"Moisture binding",body:"Sodium hyaluronate adds hydration. It has a different role from the antioxidants."}]},
    routineIntro:"Use after cleansing and toning, before moisturizer. Include sunscreen when applying in the morning.",routineNote:"The formula contains fragrance. Check the complete ingredient list if you avoid fragranced skincare. Antioxidant skincare does not replace sunscreen."
  },
  "anti-aging-cleanser-with-peptides": {
    eyebrow:"A CONSIDERED FIRST STEP",title:"Start clean. Keep the comfort.",
    introduction:"A daily facial cleanser with peptides, glycerin and panthenol. Wash away buildup while keeping a soft, comfortable skin feel in focus.",
    imageAlt:"Skincare application editorial: a man massages a small amount of cleanser onto damp cheeks",photoCaption:"A small amount. Damp skin. A thorough rinse.",
    benefits:[{title:"Lift daily buildup",body:"Massage onto damp skin as the first step in your morning or evening routine."},{title:"Make space for comfort",body:"Glycerin and panthenol bring moisture-focused conditioning into the cleansing formula."},{title:"Prepare for what follows",body:"Rinse thoroughly, then continue with your chosen tonic, serum and moisturizer."}],
    facts:[{value:"01",label:"The first step",detail:"Begin with cleansing."},{value:"207 mL",label:"Daily cleanser",detail:"A rinse-off facial formula."},{value:"AM / PM",label:"Morning and evening",detail:"Massage onto damp skin, then rinse."}],
    formulaTitle:"Cleansing, with supporting care.",formulaIntro:"A rinse-off formula that brings conditioning ingredients into your first skincare step.",
    perspective:{eyebrow:"RINSE-OFF + LEAVE-ON",title:"Give each step its own job.",body:"The cleanser is massaged onto damp skin and rinsed away. It starts the routine; your leave-on serum and moisturizer provide the treatment and finishing steps that follow.",points:[{title:"During cleansing",body:"Glycerin and panthenol complement the cleansing ingredients."},{title:"After rinsing",body:"Continue with a hydration or treatment step suited to your skin."}]},
    routineIntro:"A straightforward first step, morning and evening. Use a small amount and take care to rinse thoroughly.",routineNote:"The formula contains fragrance. Review the complete ingredient list if you avoid fragranced products."
  },
  "hydrating-tonic": {
    eyebrow:"LIGHTWEIGHT HYDRATION",title:"A fresh layer of moisture.",
    introduction:"An aloe-based tonic with glycerin and sodium PCA. A water-light layer between cleansing and the rest of your routine.",
    imageAlt:"Tonic application editorial: a woman sweeps a cotton pad over her neck below the jaw",photoCaption:"Sweep over the face and neck after cleansing.",
    benefits:[{title:"Bring in moisture",body:"Glycerin and sodium PCA are humectants: ingredients that attract and bind water."},{title:"Keep the layer light",body:"A water-light tonic adds hydration before the richer products in your routine."},{title:"Condition as you go",body:"Aloe and panthenol round out the formula’s conditioning care."}],
    facts:[{value:"198 mL",label:"Hydrating tonic",detail:"A light layer after cleansing."},{value:"AM / PM",label:"Twice-daily use",detail:"Sweep over the face and neck."},{value:"02",label:"Before your serum",detail:"Cleanse, then add this hydration step."}],
    formulaTitle:"Water-binding ingredients. Weightless care.",formulaIntro:"Humectants and conditioning ingredients work together in the tonic step.",
    perspective:{eyebrow:"WHAT A TONIC DOES",title:"Hydration has a place before cream.",body:"A light hydrating layer and a richer moisturizer serve different purposes in a routine. This tonic adds water-binding ingredients after cleansing, before serum and cream.",points:[{title:"Humectants",body:"Glycerin and sodium PCA attract and bind water."},{title:"Your next step",body:"Follow with your chosen serum and moisturizer."}]},
    routineIntro:"Use a cotton pad to sweep over the face and neck. Continue with the leave-on products you have chosen.",routineNote:"This is the range’s hydration step. Exfoliating Pads provide a separate acid-based exfoliation step. The tonic includes fragrance and colorants."
  },
  "exfoliating-pads": {
    eyebrow:"TARGETED EXFOLIATION",title:"A more refined-looking surface.",
    introduction:"Mandelic, lactic and salicylic acids in pre-moistened pads. A focused exfoliating step for uneven texture and dull-looking skin.",
    imageAlt:"Application editorial: a woman holds an exfoliating pad against her outer cheek away from the eye",photoCaption:"Target the area. Keep clear of the eyes.",
    benefits:[{title:"Refine visible texture",body:"An acid-based exfoliating step for areas that look dull or feel uneven."},{title:"Combine AHA + BHA",body:"Mandelic and lactic acids are AHAs; salicylic acid brings the BHA component."},{title:"Make application practical",body:"Pre-moistened pads let you focus application on the areas you want to exfoliate."}],
    facts:[{value:"03",label:"Exfoliating acids",detail:"Mandelic, lactic and salicylic."},{value:"02",label:"Acid families",detail:"AHA and BHA in one formula."},{value:"50",label:"Pre-moistened pads",detail:"Ready for targeted application."}],
    formulaTitle:"Three acids. Two complementary families.",formulaIntro:"Meet the exfoliating blend and the supporting ingredients alongside it.",
    perspective:{eyebrow:"AHA + BHA, EXPLAINED",title:"Know the acids you are using.",body:"The three named acids belong to two ingredient families. Understanding the blend makes it easier to account for other exfoliating products in your routine.",points:[{title:"Mandelic + lactic",body:"The two alpha hydroxy acids in the formula, used for surface exfoliation."},{title:"Salicylic",body:"The beta hydroxy acid component, included for congested-looking skin."}]},
    routineIntro:"Sweep over the areas you want to exfoliate after cleansing. Follow the product label for frequency.",routineNote:"AHAs can increase sun sensitivity. Use sunscreen, wear protective clothing and limit sun exposure during use and for a week afterwards. Plan other exfoliants and retinoids carefully."
  },
  "firming-peptide-eye-gel": {
    eyebrow:"CARE FOR THE EYE AREA",title:"A little care. A lighter feel.",
    introduction:"A peptide eye gel with aloe, cucumber water and moisture-binding ingredients. A targeted step for those who prefer a light gel around the eyes.",
    imageAlt:"Eye-care application editorial showing a fingertip gently touching skin below the outer eye",photoCaption:"A small amount, applied gently around the eye area.",
    benefits:[{title:"Target the eye area",body:"A dedicated application step for the skin around the eyes, used with a gentle touch."},{title:"Choose a gel texture",body:"A lightweight alternative for those who prefer a less rich feel than an eye cream."},{title:"Bring peptides and hydration together",body:"Three named peptides sit alongside aloe, cucumber water and humectants."}],
    facts:[{value:"03",label:"Named peptides",detail:"Tripeptide-5, tripeptide-1 and tetrapeptide-7."},{value:"15 mL",label:"Eye gel",detail:"A targeted, lightweight format."},{value:"AM / PM",label:"Twice-daily care",detail:"Apply gently after cleansing."}],
    formulaTitle:"Peptide care, in a light gel.",formulaIntro:"A focused blend with conditioning ingredients and moisture support for the eye-area step.",
    perspective:{eyebrow:"TEXTURE + PLACEMENT",title:"The eye step is about how, too.",body:"A small amount and a gentle touch suit this targeted application. Keep the gel around the eye area and outside the eyes themselves.",points:[{title:"The texture choice",body:"A gel for those who prefer a lighter feel around the eyes."},{title:"The supporting care",body:"Aloe, cucumber water, glycerin and sodium PCA complement the peptide blend."}]},
    routineIntro:"Use a small amount around the eye area after cleansing. Apply gently, morning and evening.",routineNote:"Avoid direct contact with the eyes. Follow the product label and stop use if irritation occurs."
  },
  "copper-peptide-restore-cream": {
    eyebrow:"PEPTIDES + RICHER MOISTURE",title:"Give your routine a softer finish.",
    introduction:"Copper peptide and a supporting peptide blend meet shea butter and sodium hyaluronate. A richer cream step with both treatment ingredients and moisture-focused care.",
    imageAlt:"Moisturizer application editorial: a woman gently smooths a small amount of cream over her cheek",photoCaption:"Apply to the face and neck after your serum.",
    benefits:[{title:"Choose richer care",body:"Shea butter brings emollient softness to a cream finish."},{title:"Support hydration",body:"Glycerin and sodium hyaluronate bind water within the formula."},{title:"Look at the complete blend",body:"Copper peptide is joined by other peptides, niacinamide and retinol—details to consider when layering."}],
    facts:[{value:"GHK-Cu",label:"Copper peptide",detail:"Alongside a supporting peptide blend."},{value:"50 mL",label:"Cream format",detail:"Apply to the face and neck."},{value:"Retinol",label:"Also in this formula",detail:"Account for your other active products."}],
    formulaTitle:"Peptides. Humectants. Emollients.",formulaIntro:"Three different roles within a richer cream, with ingredient details that matter to your routine.",
    perspective:{eyebrow:"UNDERSTAND YOUR MOISTURIZER",title:"Water binding and softness are different jobs.",body:"A moisturizer can include ingredients that attract water and ingredients that soften the skin. This formula brings both together alongside copper peptide and the supporting blend.",points:[{title:"Humectants",body:"Glycerin and sodium hyaluronate bind water."},{title:"Emollient care",body:"Shea butter adds softness and a richer finish."}]},
    routineIntro:"Apply after cleansing and your chosen serum. Check the whole routine before combining active products.",routineNote:"Contains retinol and niacinamide. Consider other retinol or exfoliating products before layering. Follow with sunscreen in the morning; follow all warnings on the product label."
  }
};
