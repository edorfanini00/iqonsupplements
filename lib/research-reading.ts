/** Reading notes for the citations already published in product-copy.json.
 * These describe ingredient research, never finished-product testing. */
export const researchReading: Record<string,{studied:string;finding:string;relevance:string;limitation:string}> = {
 "creatine-monohydrate": {
  studied:"Human creatine supplementation studies, including muscle creatine storage and repeated high intensity exercise.",
  finding:"Regular intake increases muscle creatine stores. The strongest performance evidence concerns repeated intense exercise alongside training.",
  relevance:"Creatine monohydrate is the single ingredient listed for this powder.",
  limitation:"The studies do not test this IQON product or guarantee an individual result. Follow the complete loading and maintenance directions."
 },
 "hydrolyzed-collagen-peptides": {
  studied:"A placebo controlled trial of a specific collagen hydrolysate in 69 women over eight weeks.",
  finding:"The trial reported a change in skin elasticity. Moisture findings were not statistically significant.",
  relevance:"This product contains hydrolyzed bovine collagen peptides.",
  limitation:"The exact preparation and amount matter. This trial did not test the IQON powder and does not promise the same outcome."
 },
 "collagen-peptides-chocolate": {
  studied:"A human trial of a specific collagen hydrolysate and measures of skin elasticity.",
  finding:"The cited trial reported an elasticity change with the studied preparation.",
  relevance:"Collagen peptides are the foundation of this cocoa and stevia blend.",
  limitation:"The trial did not test this flavored IQON blend. Flavor, jar size and the word collagen do not establish a match to the studied preparation."
 },
 "colostrum-powder": {
  studied:"A small crossover study in 12 volunteers examining intestinal permeability after strenuous exercise.",
  finding:"The tested bovine colostrum preparation was associated with a smaller exercise related increase in intestinal permeability.",
  relevance:"Bovine colostrum is the ingredient in this powder. The study helps explain one question researchers have examined.",
  limitation:"This narrow finding does not establish a general digestive or immune benefit. The study did not test IQON Colostrum Powder."
 },
 "nmn": {
  studied:"A ten week randomized trial in postmenopausal women with prediabetes who were overweight or obese.",
  finding:"The trial reported changes in muscle insulin sensitivity in that specific population.",
  relevance:"NMN is a precursor in the NAD+ pathway and the ingredient named in this capsule.",
  limitation:"This was not a lifespan study or a test of the IQON formula. It does not establish the same effects in other populations."
 },
 "resveratrol": {
  studied:"Separate human trials in men with obesity and in nonobese women with normal glucose tolerance.",
  finding:"The trial in men reported metabolic changes. The trial in women did not find improved metabolic function.",
  relevance:"The product lists a resveratrol complex standardized for its trans resveratrol content.",
  limitation:"Population, preparation and study design differ. Neither trial tests this IQON formula or establishes a universal benefit."
 },
 "hair-skin-nails-gummies": {
  studied:"NIH’s overview of biotin nutrition and the evidence for hair, skin and nails claims.",
  finding:"Biotin helps the body use carbohydrates, fats and proteins. Evidence for additional visible benefits is limited in people without a deficiency.",
  relevance:"Biotin is one of the nutrients listed in these gummies.",
  limitation:"This is ingredient education, not a clinical trial of this formula or a guarantee of a visible result."
 }
};
