/** Editorial gallery copy. Amounts come from supplement-details.ts and skincare-range.json.
 * These are product facts and ingredient explanations, not finished-formula clinical results. */
export type ProductVisual = {
  headline: string; lead: string; benefitTitle: string; benefits: string[];
  fact: { value: string; label: string; body: string };
  whyTitle: string; whyBody: string; mechanismTitle: string;
  mechanism: { title: string; body: string }[];
  ritualTitle: string; image: string; imageAlt: string;
};
const water = { image: "/images/editorial/daily-water-v24.webp", imageAlt: "A daily glass of water in a sunlit kitchen" };
const movement = { image: "/images/editorial/iqon-pilates-editorial.webp", imageAlt: "Preparing for a daily movement routine" };
const skin = { image: "/images/editorial/iqon-skincare-hero-v29.webp", imageAlt: "Natural skin in soft window light" };
export const productVisuals: Record<string, ProductVisual> = {
  "creatine-monohydrate": {
    headline: "Made for your next rep.", lead: "Unflavored creatine monohydrate for repeated, high-intensity efforts. One ingredient that fits around the training you already do.*",
    benefitTitle: "For the work you put in.", benefits: ["Repeated, high-intensity performance*", "One ingredient: creatine monohydrate", "No added caffeine or sweeteners"],
    fact: { value: "01", label: "ingredient. A focused formula.", body: "Creatine monohydrate. Unflavored, so you can make it part of your own routine." },
    whyTitle: "Your muscles need energy. Again and again.", whyBody: "A heavy set or a sprint asks your muscles for energy quickly. Creatine supports the system that replenishes ATP during these brief, intense efforts. It belongs alongside consistent training, food and recovery.*",
    mechanismTitle: "The science behind the next effort.", mechanism: [
      { title: "Store", body: "Muscles store creatine, including as phosphocreatine." },
      { title: "Replenish", body: "Phosphocreatine helps regenerate ATP, the immediate energy source used by working muscles.*" },
      { title: "Repeat", body: "This energy system matters most during repeated, short bursts of high-intensity exercise.*" }], ritualTitle: "A small step in your training routine.", ...movement
  },
  "hydrolyzed-collagen-peptides": {
    headline: "Collagen. Without the extras.", lead: "Grass-fed bovine collagen peptides in an unflavored, single-ingredient powder. A simple addition to the drink you already enjoy.",
    benefitTitle: "Your drink. Your ritual.", benefits: ["Hydrolyzed bovine collagen", "Unflavored and easy to make your own", "No added flavors or sweeteners"],
    fact: { value: "01", label: "ingredient. Nothing to overthink.", body: "Bovine hide collagen peptides. One level scoop in your preferred chilled beverage." },
    whyTitle: "A collagen routine you can make your own.", whyBody: "Some routines are easier when they ask less of you. This unflavored powder keeps the formula focused on collagen, leaving the flavor and the moment up to you.",
    mechanismTitle: "Collagen, made clearer.", mechanism: [
      { title: "The source", body: "Bovine hide collagen is the only ingredient in this powder." },
      { title: "The form", body: "Hydrolyzed means the collagen has been broken down into smaller peptides." },
      { title: "The evidence", body: "Specific collagen preparations have been studied for skin elasticity. The study below explains the findings and their limits." }], ritualTitle: "One scoop. Your everyday drink.", ...water
  },
  "collagen-peptides-chocolate": {
    headline: "Make collagen your favorite ritual.", lead: "Grass-fed collagen peptides with cocoa and a chocolate finish. A two-scoop addition for your shaker or blender.",
    benefitTitle: "A scoop to look forward to.", benefits: ["Hydrolyzed bovine collagen", "Chocolate flavor with cocoa", "Sweetened with stevia extract"],
    fact: { value: "02", label: "scoops in your favorite beverage.", body: "Mix with 8–10 oz of liquid in a shaker or blender. The chocolate expression of IQON collagen." },
    whyTitle: "Consistency can taste good.", whyBody: "The routine you enjoy is the one you make room for. Cocoa gives this collagen powder its chocolate character, with stevia extract adding sweetness.",
    mechanismTitle: "The formula behind the flavor.", mechanism: [
      { title: "Collagen", body: "Hydrolyzed bovine collagen peptides form the foundation." },
      { title: "Cocoa", body: "Cocoa powder and natural flavor create the chocolate profile." },
      { title: "Your mix", body: "Use a shaker or blender with the liquid you prefer. The full formula includes stevia, acacia and xanthan gum." }], ritualTitle: "Turn a daily drink into a ritual.", ...water
  },
  "colostrum-powder": {
    headline: "Colostrum, clearly specified.", lead: "2,300 mg of bovine colostrum per serving, standardized to 25% IgG. One scoop for your cold drink.",
    benefitTitle: "Know what is in your scoop.", benefits: ["2,300 mg bovine colostrum", "575 mg naturally present IgG", "A simple, cold-mix powder"],
    fact: { value: "25%", label: "IgG in the bovine colostrum.", body: "575 mg of immunoglobulin G within each 2,300 mg serving of colostrum." },
    whyTitle: "The amount matters. So does the composition.", whyBody: "Colostrum is the first milk produced after a cow gives birth. Its composition is different from mature milk. IQON specifies both the colostrum amount and its IgG content, so you can see exactly what your serving provides.",
    mechanismTitle: "Understand the scoop.", mechanism: [
      { title: "Bovine colostrum", body: "Each serving contains 2,300 mg of this milk-derived ingredient." },
      { title: "Immunoglobulin G", body: "IgG is a naturally present protein. At 25%, the serving provides 575 mg." },
      { title: "One total", body: "The IgG is included within the colostrum amount. It is not another 575 mg added on top." }], ritualTitle: "Cold mix. Freshly prepared.", ...water
  },
  "colon-gentle-cleanse": {
    headline: "Make room for fiber.", lead: "Psyllium husk, ginger, tamarind and four digestive enzymes in individual sachets. A measured step for your daily routine.",
    benefitTitle: "A more practical fiber ritual.", benefits: ["Psyllium-based formula", "Four named digestive enzymes", "30 individually portioned sachets"],
    fact: { value: "30", label: "sachets. Ready to mix.", body: "One sachet in 200 mL of still water. Stir well and drink immediately, following the label directions." },
    whyTitle: "Fiber works with water.", whyBody: "Psyllium absorbs water, which is why the preparation gradually becomes gel-like. Individual sachets keep measuring simple; using the full amount of water and drinking promptly are part of the routine.",
    mechanismTitle: "A closer look at the blend.", mechanism: [
      { title: "Plant fiber", body: "Psyllium husk is the water-absorbing fiber at the center of the formula." },
      { title: "Four enzymes", body: "The blend names amylase, lactase, lipase and cellulase." },
      { title: "Botanical finish", body: "Ginger root and tamarind fruit extract complete the ingredient list." }], ritualTitle: "Measure. Mix. Drink promptly.", ...water
  },
  "keto-5": {
    headline: "Five ingredients. One focused blend.", lead: "Raspberry ketone, green tea, caffeine, green coffee bean and garcinia in a vegetable capsule. A simple format with every blend ingredient named.",
    benefitTitle: "A clearly defined blend.", benefits: ["Five named blend ingredients", "Vegetable capsule format", "60 capsules · 30 days at suggested use"],
    fact: { value: "05", label: "ingredients in the Keto Blend.", body: "Four plant-derived ingredients alongside caffeine anhydrous. Contains caffeine." },
    whyTitle: "Start with what is inside.", whyBody: "The Keto-5 blend brings together tea, coffee, raspberry ketone, garcinia and caffeine. Understanding those ingredients helps you decide how the formula fits alongside your food, activity and other supplements.",
    mechanismTitle: "Meet the five-part formula.", mechanism: [
      { title: "Tea & coffee", body: "Green tea and green coffee bean are two of the plant ingredients in the blend." },
      { title: "Caffeine", body: "Caffeine anhydrous is also included. Consider coffee, tea and other caffeine sources in your day." },
      { title: "The rest of the blend", body: "Raspberry ketone and garcinia cambogia fruit complete the five ingredients. The individual amounts are not specified." }], ritualTitle: "Build the routine around your day.", ...movement
  },
  "glp-1-support": {
    headline: "Keep nutrition in the picture.", lead: "A two-capsule formula combining essential vitamins and minerals with ginger, digestive enzymes and a probiotic. Nutritional support for a changing routine.*",
    benefitTitle: "Three parts. One daily routine.", benefits: ["Vitamins and minerals for dietary support*", "Ginger, peppermint and digestive enzymes", "LactoSpore® probiotic ingredient"],
    fact: { value: "02", label: "capsules. A 30-day routine.", body: "60 capsules per bottle, combining nutrients, botanical ingredients and digestive components." },
    whyTitle: "When your routine changes, nutrition still matters.", whyBody: "GLP-1 Support brings several nutritional priorities into one formula: vitamin and mineral intake, digestive ingredients and a probiotic. Review the complete amounts with your clinician if you use a GLP-1 medication.",
    mechanismTitle: "Three complementary parts of the formula.", mechanism: [
      { title: "Nutrient intake", body: "D3, B6, B12, folate, magnesium, iron and zinc complement dietary intake.*" },
      { title: "Digestive ingredients", body: "A 325 mg blend combines ginger, peppermint, bromelain and DigeZyme®." },
      { title: "Probiotic component", body: "LactoSpore® adds Bacillus coagulans. The listed 166 mg is ingredient weight, not a CFU count." }], ritualTitle: "A daily moment to stay consistent.", ...water
  },
  "liver-support": {
    headline: "Botanicals for your daily routine.", lead: "Seven botanical ingredients and L-cysteine in a two-capsule formula. Includes milk thistle, turmeric and artichoke extract standardized to 5% cynarin.",
    benefitTitle: "A considered botanical blend.", benefits: ["Seven botanicals with L-cysteine", "Artichoke extract · 5% cynarin", "Two capsules daily with water"],
    fact: { value: "07", label: "botanicals. Plus L-cysteine.", body: "Turmeric, beet root, dandelion, artichoke, ginger, milk thistle and alfalfa." },
    whyTitle: "Know the plants behind the formula.", whyBody: "A botanical blend is more useful when you can understand it. This formula pairs plant powders with standardized artichoke extract and an amino acid ingredient, L-cysteine hydrochloride.",
    mechanismTitle: "Three ways to read the ingredient list.", mechanism: [
      { title: "Plant powders", body: "Milk thistle, turmeric, beet root, dandelion, ginger and alfalfa make up the powder portion." },
      { title: "Standardized extract", body: "Artichoke extract specifies 5% cynarin. This describes composition, not the milligram dose." },
      { title: "L-cysteine", body: "L-cysteine hydrochloride is the amino acid ingredient alongside the botanicals." }], ritualTitle: "Two capsules. A familiar moment.", ...water
  },
  "nmn": {
    headline: "Cellular nutrition. Made simple.", lead: "500 mg of NMN, a precursor your body uses to make NAD+. One vegetable capsule for your daily cellular-nutrition routine.*",
    benefitTitle: "Start with the cellular essentials.", benefits: ["A precursor used in NAD+ production*", "500 mg β-NMN per serving", "One vegetable capsule daily"],
    fact: { value: "500", label: "mg of β-NMN per serving.", body: "One active ingredient. One vegetable capsule. 30 capsules per bottle." },
    whyTitle: "Your cells run on more than willpower.", whyBody: "NAD+ is a coenzyme involved in cellular energy metabolism. Your body uses NMN as a precursor in the pathway that makes NAD+. That biological role is the starting point for the research into NMN.*",
    mechanismTitle: "From NMN to NAD+.", mechanism: [
      { title: "NMN", body: "β-Nicotinamide mononucleotide is a precursor: a compound used to make another molecule." },
      { title: "NAD+", body: "The body uses NMN in the biosynthesis of NAD+, a coenzyme found in cells.*" },
      { title: "Cellular metabolism", body: "NAD+ participates in the reactions that help cells process energy. Ingredient biology is not a promise of a noticeable energy boost.*" }], ritualTitle: "One capsule. An everyday habit.", ...movement
  },
  "resveratrol": {
    headline: "Plant science. Clearly defined.", lead: "A Polygonum cuspidatum root complex standardized to 50% trans-resveratrol. A plant polyphenol in a convenient vegetable capsule.",
    benefitTitle: "The form makes the difference.", benefits: ["Polygonum cuspidatum root source", "50% trans-resveratrol complex", "Vegetable capsules · no mixing"],
    fact: { value: "50%", label: "trans-resveratrol in the complex.", body: "The listed 600 mg refers to the root complex, not 600 mg of pure trans-resveratrol." },
    whyTitle: "More to the label than a milligram number.", whyBody: "Resveratrol is a plant polyphenol. IQON names both the botanical source and the trans-resveratrol proportion, giving you a clearer view of the form you are choosing.",
    mechanismTitle: "Source. Form. Amount.", mechanism: [
      { title: "Botanical source", body: "The complex is derived from Polygonum cuspidatum root." },
      { title: "Specified form", body: "It is standardized to contain 50% trans-resveratrol." },
      { title: "Read together", body: "The ingredient statement lists 600 mg of the complex. Read that quantity alongside the standardization." }], ritualTitle: "A simple capsule routine.", ...water
  },
  "hair-skin-nails-gummies": {
    headline: "A little more care. Every day.", lead: "Biotin, vitamins, minerals and fish-derived collagen in passion-fruit gummies. A chewable addition to your daily nutrition routine.",
    benefitTitle: "Make your daily care easier.", benefits: ["Biotin with vitamins A, C, D and E", "Zinc and fish-derived collagen", "Passion-fruit flavor · two daily"],
    fact: { value: "02", label: "gummies. A daily moment of care.", body: "60 gummies per bottle. A 30-day supply at the suggested use." },
    whyTitle: "Good routines should feel easy to keep.", whyBody: "For people who prefer a gummy to a capsule, this formula brings together biotin, other vitamins, minerals and collagen in a passion-fruit flavor. Take it alongside a varied diet, as a simple daily habit.",
    mechanismTitle: "More than biotin alone.", mechanism: [
      { title: "B vitamins", body: "Biotin sits alongside B6, B12, folate and pantothenic acid." },
      { title: "Vitamins & minerals", body: "Vitamins A, C, D and E, zinc and iodine broaden the nutrient combination." },
      { title: "The gummy format", body: "Pectin gives the gummy its form. It also contains sugar and fish-derived collagen, so check dietary suitability." }], ritualTitle: "A chewable step in your day.", ...water
  },
  "anti-aging-cleanser-with-peptides": {
    headline: "A clean start. A comfortable finish.", lead: "A daily facial cleanser with peptides, glycerin and panthenol. Wash away buildup while keeping the focus on a soft, comfortable skin feel.",
    benefitTitle: "The first step, thoughtfully done.", benefits: ["Cleanses everyday buildup", "Glycerin and panthenol for comfort", "Peptide-enriched daily care"],
    fact: { value: "AM/PM", label: "your first step, morning and night.", body: "Massage onto damp skin and rinse thoroughly. Follow with your hydration and treatment steps." },
    whyTitle: "Start clean. Keep the comfort.", whyBody: "Cleansing sets the tone for the rest of your routine. This formula pairs a daily cleanse with moisture-focused ingredients, so the first step is about how skin feels as well as what it washes away.",
    mechanismTitle: "Cleansing with a care-first approach.", mechanism: [
      { title: "Cleanse", body: "Massage onto damp skin to wash away daily buildup." },
      { title: "Condition", body: "Glycerin and panthenol bring moisture-focused care into the rinse-off formula." },
      { title: "Prepare", body: "Rinse thoroughly, then move on to tonic, serum and moisturizer." }], ritualTitle: "Begin here. Morning and evening.", ...skin
  },
  "hydrating-tonic": {
    headline: "Give thirsty skin a fresh start.", lead: "An aloe-based tonic with glycerin and sodium PCA. Water-light hydration after cleansing, before the rest of your routine.",
    benefitTitle: "Hydration without the weight.", benefits: ["Light, moisture-binding hydration", "Aloe and panthenol care", "Layers between cleanser and serum"],
    fact: { value: "198", label: "mL of lightweight hydration.", body: "Sweep over the face and neck after cleansing. A simple layer before your chosen serum." },
    whyTitle: "The layer your routine was missing.", whyBody: "Hydration does not have to feel heavy. This water-light tonic combines moisture-binding ingredients with aloe and panthenol for a comfortable step between cleansing and treatment.",
    mechanismTitle: "Attract moisture. Keep it light.", mechanism: [
      { title: "Glycerin", body: "A humectant that attracts water to support hydration." },
      { title: "Sodium PCA", body: "Another moisture-binding ingredient that helps skin retain water." },
      { title: "Aloe & panthenol", body: "Conditioning ingredients that complete the light tonic formula." }], ritualTitle: "Cleanse. Hydrate. Continue.", ...skin
  },
  "exfoliating-pads": {
    headline: "A smoother surface starts here.", lead: "Mandelic, lactic and salicylic acids in pre-moistened pads. A targeted exfoliating step for uneven texture and dull-looking skin.",
    benefitTitle: "Reveal a more refined look.", benefits: ["For smoother-looking texture", "AHA + BHA exfoliation", "Pre-moistened pads for targeted use"],
    fact: { value: "03", label: "acids. One exfoliating step.", body: "Mandelic and lactic acids meet salicylic acid in a ready-to-use pad. 50 pads per jar." },
    whyTitle: "Less buildup. A more refined-looking surface.", whyBody: "When skin looks dull or feels uneven, exfoliation can be a useful step. This formula combines two AHAs with a BHA in a convenient pad, keeping application focused on the areas you want to refine.",
    mechanismTitle: "A closer look at AHA + BHA.", mechanism: [
      { title: "Mandelic & lactic", body: "Alpha hydroxy acids used for surface exfoliation." },
      { title: "Salicylic", body: "A beta hydroxy acid in the formula for congested-looking skin." },
      { title: "Supporting care", body: "Glycerin and botanicals sit alongside the acids. Introduce according to the label and use sun protection." }], ritualTitle: "Refine thoughtfully. Protect daily.", ...skin
  },
  "hydra-c-ferulic-serum": {
    headline: "Brighter-looking skin. A daily ritual.", lead: "Vitamin C and ferulic acid meet hydrating sodium hyaluronate. Antioxidant care for dull or uneven-looking skin, in a light serum step.",
    benefitTitle: "Brightness meets hydration.", benefits: ["For a brighter-looking complexion", "Vitamin C + ferulic antioxidant care", "Hydration with sodium hyaluronate"],
    fact: { value: "C + F", label: "vitamin C meets ferulic acid.", body: "Two antioxidant ingredients, complemented by sodium hyaluronate for hydration." },
    whyTitle: "A brighter outlook for dull-looking skin.", whyBody: "A serum can do more than one job in your routine. Vitamin C and ferulic acid provide antioxidant care, while sodium hyaluronate adds moisture in a light layer before your cream.",
    mechanismTitle: "Three ingredients. Complementary roles.", mechanism: [
      { title: "Vitamin C", body: "Ascorbic acid brings antioxidant care to a routine for dull-looking skin." },
      { title: "Ferulic acid", body: "A complementary antioxidant ingredient paired with vitamin C." },
      { title: "Sodium hyaluronate", body: "A moisture-binding ingredient for hydration alongside treatment." }], ritualTitle: "Your serum step. Before cream and SPF.", ...skin
  },
  "retinol-rx": {
    headline: "Make room for renewal.", lead: "Encapsulated retinol with niacinamide and squalane. An evening treatment for the appearance of fine lines and uneven texture.",
    benefitTitle: "A more refined-looking tomorrow.", benefits: ["For the appearance of fine lines", "Targets uneven-looking texture", "Encapsulated retinol with moisture support"],
    fact: { value: "PM", label: "an evening treatment step.", body: "Introduce gradually as tolerated, following the label. Use SPF 30 or higher in the daytime." },
    whyTitle: "An evening step with a clear purpose.", whyBody: "Retinol is the focus; the supporting ingredients matter too. This serum pairs encapsulated retinol with niacinamide, squalane and sodium hyaluronate to bring moisture-focused care into your treatment routine.",
    mechanismTitle: "Treatment, thoughtfully supported.", mechanism: [
      { title: "Encapsulated retinol", body: "Retinol in an encapsulated delivery system, for visible lines and texture." },
      { title: "Niacinamide", body: "A vitamin B3 ingredient that complements the retinol formula." },
      { title: "Squalane & hydration", body: "An emollient and moisture-binding ingredients round out the serum." }], ritualTitle: "Start slowly. Make evenings count.", ...skin
  },
  "firming-peptide-eye-gel": {
    headline: "Fresh eyes. A lighter touch.", lead: "A cooling peptide eye gel with aloe and cucumber water. Targeted hydration for smoother-looking skin around the eyes.",
    benefitTitle: "Care for the finer details.", benefits: ["For a smoother-looking eye area", "Light, cooling gel texture", "Peptides with hydrating humectants"],
    fact: { value: "15", label: "mL of targeted eye care.", body: "A small amount around the eye area, morning and evening. Avoid direct contact with eyes." },
    whyTitle: "A little attention to the eye area.", whyBody: "The skin around the eyes calls for a targeted touch. A light gel texture combines peptide care with moisture-binding ingredients, aloe and cucumber water for a fresh-feeling routine.",
    mechanismTitle: "Targeted care, in three parts.", mechanism: [
      { title: "Peptides", body: "A blend including palmitoyl tripeptide-5, palmitoyl tripeptide-1 and palmitoyl tetrapeptide-7." },
      { title: "Humectants", body: "Sodium PCA and glycerin provide moisture-binding care." },
      { title: "Botanical ingredients", body: "Aloe and cucumber water complement the refreshing gel format." }], ritualTitle: "A small amount. A gentle touch.", ...skin
  },
  "copper-peptide-restore-cream": {
    headline: "Rich moisture. A firmer-looking finish.", lead: "A multi-peptide cream with copper peptide, shea butter and sodium hyaluronate. Comfort for dry-feeling skin, with care for a smoother-looking finish.",
    benefitTitle: "More comfort in your final step.", benefits: ["Rich moisture for dry-feeling skin", "Copper peptide with a peptide blend", "A smoother, firmer-looking finish"],
    fact: { value: "GHK-Cu", label: "copper peptide. Part of a bigger formula.", body: "A multi-peptide blend with shea butter and humectants. The complete formula also contains retinol." },
    whyTitle: "Bring comfort back to your routine.", whyBody: "Dry-feeling skin needs a moisturizing step you enjoy using. Shea butter gives this cream richness, humectants bind moisture, and copper peptide joins a wider peptide blend for a smoother, firmer-looking finish.",
    mechanismTitle: "Moisture and peptide care, together.", mechanism: [
      { title: "Peptide care", body: "GHK-Cu sits alongside palmitoyl tripeptide-5, acetyl hexapeptide-8 and palmitoyl dipeptide-5." },
      { title: "Emollient comfort", body: "Shea butter brings richness and a soft, cushioned feel." },
      { title: "Moisture binding", body: "Glycerin and sodium hyaluronate complement the cream texture." }], ritualTitle: "Finish with comfort. Follow with daytime SPF.", ...skin
  }
};
