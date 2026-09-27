/** Product-specific editorial facts. Values are from the supplied product statements,
 * not performance results. Each photograph has one role and one placement per page. */
export type ProductPresentation = {
  detail: string; detailAlt: string; detailLabel: string;
  kicker: string; title: string; fact: string; factLabel: string;
  diagram: 'composition' | 'steps' | 'pair' | 'list';
  percentage?: number; labels: string[]; note: string;
  focus: { eyebrow: string; title: string; body: string; layout: 'process' | 'compare' | 'specification'; rows: { label: string; value: string; detail: string }[] };
};
const detail = (id: string) => `/images/product-details/${id}.webp`;
export const productPresentation: Record<string, ProductPresentation> = {
  'creatine-monohydrate': {
    detail:'/images/product-editorial/powder-macro.webp',detailAlt:'Close study of fine white powder on a dark surface',detailLabel:'A closer look · powder',
    kicker:'SINGLE-INGREDIENT FORMULA',title:'Only creatine monohydrate.',fact:'1',factLabel:'ingredient',diagram:'list',labels:['Unflavored','No added caffeine','No added sweeteners'],note:'281 g powder per jar.',
    focus:{eyebrow:'THE ENERGY SYSTEM',title:'Built for repeated effort.',body:'Creatine supports the rapid energy system used in lifting, sprinting and other brief, intense exercise.*',layout:'process',rows:[{label:'01',value:'Store',detail:'Muscles store creatine, including as phosphocreatine.'},{label:'02',value:'Replenish',detail:'Phosphocreatine helps regenerate ATP, the immediate energy used by working muscles.*'},{label:'03',value:'Repeat',detail:'Regular use belongs alongside consistent training, food and recovery.'}]}
  },
  'hydrolyzed-collagen-peptides': {
    detail:detail('hydrolyzed-collagen-peptides'),detailAlt:'Spoon stirring a cold drink in a clear glass',detailLabel:'Preparation · a chilled drink',
    kicker:'THE UNFLAVORED OPTION',title:'Your drink stays yours.',fact:'1',factLabel:'level scoop',diagram:'steps',labels:['Scoop','8–10 oz chilled liquid','Shake for 5 seconds'],note:'Bovine collagen peptides. No added flavor or sweetener.',
    focus:{eyebrow:'CHOOSE YOUR COLLAGEN',title:'One ingredient. More ways to make it yours.',body:'The unflavored and chocolate powders share a bovine collagen foundation, with different formulas and preparation.',layout:'compare',rows:[{label:'THIS FORMULA',value:'Unflavored',detail:'One ingredient: bovine hide collagen peptides. One level scoop in a chilled drink.'},{label:'THE ALTERNATIVE',value:'Chocolate',detail:'Cocoa, natural flavor and stevia with collagen. Two scoops in a shaker or blender.'}]}
  },
  'collagen-peptides-chocolate': {
    detail:'/images/product-editorial/cocoa-macro.webp',detailAlt:'Close study of cocoa-colored powder',detailLabel:'Ingredient detail · cocoa',
    kicker:'THE CHOCOLATE BLEND',title:'Collagen with character.',fact:'Cocoa',factLabel:'for a chocolate finish',diagram:'pair',labels:['Bovine collagen','Cocoa + natural flavor','Stevia extract'],note:'Two scoops in 8–10 oz of your preferred beverage.',
    focus:{eyebrow:'THE FLAVOR FORMULA',title:'A blend worth making time for.',body:'Every part of the chocolate blend has a different job, from the collagen foundation to the finished drink.',layout:'specification',rows:[{label:'FOUNDATION',value:'Hydrolyzed collagen',detail:'Bovine hide collagen peptides form the base.'},{label:'TASTE',value:'Cocoa + stevia',detail:'Cocoa and natural flavor give chocolate character; stevia adds sweetness.'},{label:'PREPARATION',value:'Shake or blend',detail:'Acacia and xanthan gum are also in the formula. Mix the full two-scoop serving well.'}]}
  },
  'colostrum-powder': {
    detail:detail('colostrum-powder'),detailAlt:'Fine ivory powder in a small metal scoop',detailLabel:'A closer look · the scoop',
    kicker:'SERVING COMPOSITION',title:'Know your colostrum.',fact:'25%',factLabel:'IgG content',diagram:'composition',percentage:25,labels:['575 mg IgG','2,300 mg colostrum total'],note:'IgG is included within the total colostrum amount.',
    focus:{eyebrow:'READ THE NUMBERS',title:'One serving. Two useful measurements.',body:'The colostrum amount tells you how much you take. The IgG percentage describes what is within it.',layout:'specification',rows:[{label:'TOTAL',value:'2,300 mg',detail:'Bovine colostrum per serving.'},{label:'WITHIN THE TOTAL',value:'575 mg IgG',detail:'25% of the colostrum serving. This is not an additional dose.'},{label:'SOURCE',value:'Milk-derived',detail:'A bovine ingredient; account for milk allergy when choosing.'}]}
  },
  'colon-gentle-cleanse': {
    detail:'/images/product-editorial/sachet-macro.webp',detailAlt:'Detail of a sealed white sachet on a charcoal surface',detailLabel:'Format detail · individual sachets',
    kicker:'PREPARATION MATTERS',title:'Fiber works with water.',fact:'200 mL',factLabel:'still water per sachet',diagram:'steps',labels:['Empty one sachet','Stir thoroughly','Drink immediately'],note:'The psyllium mixture thickens as it takes up water.',
    focus:{eyebrow:'A PRACTICAL FIBER ROUTINE',title:'Mix it when you need it.',body:'Psyllium absorbs water and becomes gel-like. Preparation and timing are part of using this formula correctly.',layout:'process',rows:[{label:'MIX',value:'Use the full glass',detail:'One sachet in 200 mL of non-carbonated water. Never take the powder dry.'},{label:'DRINK',value:'Do not leave it standing',detail:'Stir well and drink immediately, before the mixture thickens.'},{label:'SPACE',value:'Keep the right interval',detail:'Use separate from meals and at least two hours after medication, following the label.'}]}
  },
  'keto-5': {
    detail:detail('keto-5'),detailAlt:'Green tea leaves and unroasted green coffee beans on dark stone',detailLabel:'Ingredient study · tea + coffee',
    kicker:'INSIDE THE KETO BLEND',title:'Five named ingredients.',fact:'5',factLabel:'blend ingredients',diagram:'list',labels:['Raspberry ketone','Green tea','Caffeine anhydrous','Green coffee bean','Garcinia cambogia'],note:'Contains caffeine. Individual amounts are not disclosed.',
    focus:{eyebrow:'CAFFEINE, CONSIDERED',title:'Look at your whole day.',body:'Keto-5 combines caffeine anhydrous with tea and coffee ingredients. Consider these alongside other caffeine sources.',layout:'compare',rows:[{label:'IN THIS BLEND',value:'Three caffeine sources',detail:'Caffeine anhydrous, green tea and green coffee bean can contribute caffeine.'},{label:'IN YOUR ROUTINE',value:'Coffee, tea, pre-workout',detail:'The total caffeine amount is not specified. Do not assume a measured caffeine dose or a weight-loss result.'}]}
  },
  'glp-1-support': {
    detail:detail('glp-1-support'),detailAlt:'Cut ginger root and fresh peppermint leaves on brushed silver',detailLabel:'Ingredient study · ginger + peppermint',
    kicker:'NUTRIENTS + DIGESTIVE INGREDIENTS',title:'More than one kind of support.',fact:'2',factLabel:'capsules daily',diagram:'pair',labels:['Vitamins + minerals','Digestive blend','LactoSpore®'],note:'60 capsules. 30 days at suggested use.',
    focus:{eyebrow:'READ THE FORMULA',title:'Three parts to understand.',body:'Daily nutrients sit alongside digestive ingredients and a probiotic. Review the listed amounts with your existing routine.',layout:'specification',rows:[{label:'DIGESTIVE BLEND',value:'325 mg',detail:'Gingerols™ ginger, peppermint, bromelain and DigeZyme®.'},{label:'PROBIOTIC',value:'166 mg',detail:'LactoSpore® (Bacillus coagulans), listed by weight. A CFU count is not provided.'},{label:'IRON',value:'18 mg',detail:'Check overlap with multivitamins. This supplement does not replace GLP-1 medication or medical care.'}]}
  },
  'liver-support': {
    detail:detail('liver-support'),detailAlt:'Artichoke leaves and cut turmeric root on gray stone',detailLabel:'Ingredient study · artichoke + turmeric',
    kicker:'THE BOTANICAL FORMULA',title:'Plants, clearly named.',fact:'7 + 1',factLabel:'botanicals + L-cysteine',diagram:'list',labels:['Milk thistle + turmeric','Artichoke + dandelion','Beet root + ginger + alfalfa'],note:'Two capsules daily with water. No ingredient doses are stated.',
    focus:{eyebrow:'POWDER, EXTRACT, AMINO ACID',title:'Different forms. One ingredient list.',body:'The form of an ingredient is useful information. A powder, a standardized extract and an amino acid are different things.',layout:'specification',rows:[{label:'BOTANICAL POWDERS',value:'Six named plants',detail:'Turmeric, beet root, dandelion, ginger, milk thistle and alfalfa.'},{label:'STANDARDIZED EXTRACT',value:'Artichoke · 5% cynarin',detail:'The percentage describes composition, not a stated milligram amount.'},{label:'AMINO ACID',value:'L-cysteine HCl',detail:'The non-botanical ingredient in the blend. This is not a treatment for liver disease.'}]}
  },
  'nmn': {
    detail:'/images/supplements/17_hero_nmn_hand.webp',detailAlt:'IQON NMN bottle held in a hand',detailLabel:'In hand · the daily format',
    kicker:'THE DAILY SERVING',title:'Cellular nutrition, simply.',fact:'500 mg',factLabel:'β-NMN per serving',diagram:'steps',labels:['One capsule','Once daily','30-capsule bottle'],note:'β-Nicotinamide mononucleotide in a vegetable capsule.',
    focus:{eyebrow:'NMN, EXPLAINED',title:'A precursor. A coenzyme. A research question.',body:'NMN is studied because of its role in the pathway that supplies NAD+, a coenzyme involved in cellular metabolism.',layout:'process',rows:[{label:'THE INGREDIENT',value:'NMN',detail:'β-Nicotinamide mononucleotide is a precursor in NAD+ metabolism.'},{label:'THE PATHWAY',value:'NAD+',detail:'A coenzyme involved in energy metabolism and cellular processes.'},{label:'THE EVIDENCE',value:'Human research',detail:'Studies examine specific doses and populations. They do not establish that IQON NMN slows aging.'}]}
  },
  'resveratrol': {
    detail:detail('resveratrol'),detailAlt:'Macro detail of dried botanical root and its cut fibers',detailLabel:'Ingredient study · botanical root',
    kicker:'ROOT COMPLEX COMPOSITION',title:'Read beyond the headline amount.',fact:'50%',factLabel:'trans-resveratrol',diagram:'composition',percentage:50,labels:['Trans-resveratrol','600 mg listed root complex'],note:'The 600 mg amount refers to the complex, not pure trans-resveratrol.',
    focus:{eyebrow:'AMOUNT VS. STANDARDIZATION',title:'Two numbers with different meanings.',body:'A complex amount and an active-compound percentage describe different parts of the ingredient specification.',layout:'compare',rows:[{label:'LISTED AMOUNT',value:'600 mg complex',detail:'The amount given for the Polygonum cuspidatum root complex.'},{label:'COMPOSITION',value:'50% trans-resveratrol',detail:'The standardized proportion of the complex. Read the two figures together.'}]}
  },
  'hair-skin-nails-gummies': {
    detail:'/images/product-editorial/gummy-macro.webp',detailAlt:'Close detail of ruby-colored gummies on a dark surface',detailLabel:'A closer look · the chewable format',
    kicker:'YOUR CHEWABLE ROUTINE',title:'A passion-fruit finish.',fact:'2',factLabel:'gummies daily',diagram:'pair',labels:['Biotin + B vitamins','Vitamins + minerals','Fish-derived collagen'],note:'60 gummies per bottle. Contains fish-derived collagen and sugars.',
    focus:{eyebrow:'BEYOND BIOTIN',title:'A broader nutrient combination.',body:'The formula combines several nutrient groups in a chewable format. The full ingredient list matters as much as the name.',layout:'specification',rows:[{label:'B VITAMINS',value:'Biotin and more',detail:'B6, B12, folate and pantothenic acid sit alongside biotin.'},{label:'OTHER NUTRIENTS',value:'A, C, D, E + minerals',detail:'Includes zinc and iodine. Individual nutrient amounts are not supplied.'},{label:'COLLAGEN SOURCE',value:'Fish-derived',detail:'The gummy uses pectin, but the complete formula is not vegan.'}]}
  },
  'anti-aging-cleanser-with-peptides': {
    detail:detail('anti-aging-cleanser-with-peptides'),detailAlt:'Fine cleansing foam and tiny soap bubbles on a silver-gray glass dish',detailLabel:'The cleansing step',
    kicker:'RINSE-OFF CARE',title:'Start with comfortable skin.',fact:'01',factLabel:'the cleansing step',diagram:'steps',labels:['Dampen','Massage gently','Rinse thoroughly'],note:'Morning and evening. Glycerin, panthenol and peptides.',
    focus:{eyebrow:'RINSE-OFF VS. LEAVE-ON',title:'Give each step its own job.',body:'This cleanser starts the routine by removing daily buildup. Your serum and moisturizer remain on the skin afterwards.',layout:'compare',rows:[{label:'RINSE OFF',value:'Cleanse + condition',detail:'Glycerin and panthenol complement the cleansing formula. Rinse thoroughly.'},{label:'LEAVE ON',value:'Treat + moisturize',detail:'Apply your selected serum and moisturizer after cleansing. Finish with SPF by day.'}]}
  },
  'hydrating-tonic': {
    detail:detail('hydrating-tonic'),detailAlt:'A damp cotton round with fine fibers held between fingertips',detailLabel:'Application detail · cotton pad',
    kicker:'A LIGHT HYDRATION LAYER',title:'Between clean and cared for.',fact:'02',factLabel:'after cleansing',diagram:'steps',labels:['Cleanser','Hydrating Tonic','Serum + moisturizer'],note:'Aloe, glycerin and sodium PCA. Morning and evening.',
    focus:{eyebrow:'HYDRATION OR EXFOLIATION?',title:'Choose the step your skin needs.',body:'A tonic and an acid pad can look similar in a routine, but they serve different purposes.',layout:'compare',rows:[{label:'HYDRATING TONIC',value:'Add moisture',detail:'Aloe, glycerin and sodium PCA provide a light hydration step before serum.'},{label:'EXFOLIATING PADS',value:'Refine texture',detail:'Mandelic, lactic and salicylic acids provide the collection’s exfoliation step.'}]}
  },
  'exfoliating-pads': {
    detail:detail('exfoliating-pads'),detailAlt:'A textured cotton treatment pad lifted above a silver tray',detailLabel:'Format detail · the treatment pad',
    kicker:'THE ACID BLEND',title:'Two families. Three acids.',fact:'AHA + BHA',factLabel:'targeted exfoliation',diagram:'pair',labels:['Mandelic acid · AHA','Lactic acid · AHA','Salicylic acid · BHA'],note:'50 pre-moistened pads. Follow the label for frequency.',
    focus:{eyebrow:'UNDERSTAND THE EXFOLIANTS',title:'Surface texture, considered.',body:'The blend brings two alpha hydroxy acids together with a beta hydroxy acid for uneven and congested-looking skin.',layout:'compare',rows:[{label:'AHAs',value:'Mandelic + lactic',detail:'Exfoliate at the surface to help refine the look of uneven texture.'},{label:'BHA',value:'Salicylic acid',detail:'Complements the AHAs in the formula. Plan other exfoliants and retinoids carefully.'}]}
  },
  'hydra-c-ferulic-serum': {
    detail:detail('hydra-c-ferulic-serum'),detailAlt:'A translucent serum-like streak on frosted glass showing fine liquid texture',detailLabel:'Texture study · a serum layer',
    kicker:'ANTIOXIDANTS + HYDRATION',title:'Three ingredients. Distinct roles.',fact:'C + F',factLabel:'vitamin C + ferulic acid',diagram:'pair',labels:['Vitamin C · antioxidant','Ferulic acid · partner','Hyaluronate · hydration'],note:'Apply before moisturizer. Finish with SPF in the morning.',
    focus:{eyebrow:'THE ANTIOXIDANT PAIRING',title:'Brightness meets moisture.',body:'Vitamin C and ferulic acid provide antioxidant care. Sodium hyaluronate adds a separate hydration role.',layout:'specification',rows:[{label:'VITAMIN C',value:'Ascorbic acid',detail:'The vitamin C form in the serum, for antioxidant care and brighter-looking skin.'},{label:'FERULIC ACID',value:'Antioxidant partner',detail:'Complements vitamin C in the formula.'},{label:'SODIUM HYALURONATE',value:'Moisture binding',detail:'A humectant that helps keep skin hydrated. This serum does not replace sunscreen.'}]}
  },
  'retinol-rx': {
    detail:detail('retinol-rx'),detailAlt:'A small cream dab being spread over naturally textured adult skin',detailLabel:'Application detail · a gentle start',
    kicker:'YOUR EVENING TREATMENT',title:'Start slowly. Stay consistent.',fact:'PM',factLabel:'retinol belongs at night',diagram:'steps',labels:['Apply as directed','Build with tolerance','SPF 30+ by day'],note:'Encapsulated retinol with niacinamide, squalane and humectants.',
    focus:{eyebrow:'PLAN THE WHOLE ROUTINE',title:'Give retinol room.',body:'Introduce the treatment gradually. More active products do not automatically make a better routine.',layout:'compare',rows:[{label:'EVENING',value:'Retinol + moisture',detail:'Follow the label and build frequency as tolerated. Do not increase use through irritation.'},{label:'MORNING',value:'SPF 30 or higher',detail:'Protect skin by day. Copper Peptide Restore Cream also contains retinol; account for both products.'}]}
  },
  'firming-peptide-eye-gel': {
    detail:detail('firming-peptide-eye-gel'),detailAlt:'Editorial close-up of an adult woman’s eye area with natural pores and fine lines',detailLabel:'The eye area · editorial portrait',
    kicker:'TARGETED PEPTIDE CARE',title:'A light touch for finer details.',fact:'15 mL',factLabel:'dedicated eye care',diagram:'pair',labels:['Peptides · targeted care','Aloe + cucumber · conditioning','PCA + glycerin · hydration'],note:'A small amount, morning and evening. Avoid direct eye contact.',
    focus:{eyebrow:'THE LIGHTWEIGHT OPTION',title:'Gel care around the eyes.',body:'A dedicated eye step combines peptides with moisture-binding ingredients in a light, cooling format.',layout:'specification',rows:[{label:'TEXTURE',value:'Cooling gel feel',detail:'For those who prefer a light touch around the eye area.'},{label:'PLACEMENT',value:'Around, not in, the eye',detail:'Apply a small amount gently and avoid direct eye contact.'},{label:'ROUTINE',value:'Morning + evening',detail:'Use on clean skin before completing the rest of your routine.'}]}
  },
  'copper-peptide-restore-cream': {
    detail:detail('copper-peptide-restore-cream'),detailAlt:'Ivory moisturizer texture with fine spatula ridges on silver-gray glass',detailLabel:'Texture study · a richer finish',
    kicker:'PEPTIDES + MOISTURE',title:'A cushioned finishing step.',fact:'GHK-Cu',factLabel:'copper peptide',diagram:'pair',labels:['Peptide blend','Shea butter','Moisture-binding humectants'],note:'Also contains retinol and niacinamide. Consider other active steps.',
    focus:{eyebrow:'TWO SIDES OF MOISTURIZING',title:'Water binding. Emollient comfort.',body:'A cream’s feel comes from more than its headline ingredient. Humectants and emollients play complementary roles.',layout:'compare',rows:[{label:'HUMECTANTS',value:'Glycerin + hyaluronate',detail:'Bind water to support hydration.'},{label:'EMOLLIENT',value:'Shea butter',detail:'Adds richness and softness alongside the peptide blend. The formula also includes retinol.'}]}
  }
};
