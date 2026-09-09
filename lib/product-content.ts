/** IQON preview content. Packaging names and formats are the current source of truth.
 * No efficacy, dose, certification, ingredient list or customer review is invented.
 * This content is used only in preview mode; live Shopify descriptions stay authoritative.
 */
export type ProductContent = {
  descriptor: string;
  description: string;
  highlights: string[];
  title: string;
  story: string;
  facts: { label: string; value: string; detail: string }[];
  faqs: { question: string; answer: string }[];
};
const fact = (label:string,value:string,detail:string) => ({label,value,detail});
const faq = (question:string,answer:string) => ({question,answer});
export const productContent: Record<string,ProductContent> = {
  'creatine-monohydrate': {
    descriptor:'Creatine monohydrate. In powder form.',
    description:'A 281 g jar of creatine monohydrate powder. Get to know the format, see the product up close and compare it with the other powders in our collection.',
    highlights:['Creatine monohydrate','Powder format','281 g per jar'],
    title:'Start with the ingredient.',
    story:'Creatine Monohydrate keeps the ingredient name front and center. This is the powder format in the IQON collection, presented in a 281 g jar. Below, you can compare the ingredient and pack size with our collagen powders—each is a different product, with its own place in the collection.',
    facts:[fact('Ingredient named','Creatine','Monohydrate is the form named on this product.'),fact('Net weight','281 g','The amount of powder in one jar.'),fact('Format','Powder','A jar format, rather than capsules or gummies.')],
    faqs:[faq('Is this a powder or a capsule?','IQON Creatine Monohydrate is a powder, supplied in a 281 g jar.'),faq('Is creatine the same product as collagen?','No. Creatine Monohydrate and Collagen Peptides are different products. The product comparison shows their names, formats and pack sizes.'),faq('How many servings are in the jar?','The pack contains 281 g. Servings depend on the approved serving size, which will be published with the final Supplement Facts panel.')]
  },
  'hydrolyzed-collagen-peptides': {
    descriptor:'Grass-fed collagen, without added flavor.',
    description:'Hydrolyzed collagen peptides in an unflavored powder format. This grass-fed option comes in a 280 g jar; a separate chocolate-flavored collagen is also part of the collection.',
    highlights:['Hydrolyzed collagen peptides','Grass-fed · Unflavored','280 g per jar'],
    title:'Collagen. The unflavored option.',
    story:'Choose the unflavored expression of IQON collagen if flavor is not what you are looking for. The label identifies grass-fed hydrolyzed collagen peptides, with 280 g in each jar. If you prefer a flavored option, explore Grass-Fed Collagen Peptides in chocolate alongside it.',
    facts:[fact('Ingredient named','Collagen peptides','Hydrolyzed, with grass-fed sourcing identified on the packaging.'),fact('Flavor','Unflavored','The unflavored option in the IQON collagen collection.'),fact('Net weight','280 g','Powder, presented in a jar.')],
    faqs:[faq('Does this collagen have a flavor?','This is the unflavored collagen option. IQON also has a separate chocolate-flavored collagen product.'),faq('What is the difference between the two collagen products?','This jar is labeled hydrolyzed, grass-fed and unflavored, with a net weight of 280 g. The chocolate option is labeled grass-fed and contains 378 g.'),faq('Where can I see the complete ingredient list?','The complete ingredient list, allergen information and Supplement Facts panel will be available before orders open.')]
  },
  'collagen-peptides-chocolate': {
    descriptor:'Grass-fed collagen. Chocolate flavor.',
    description:'Chocolate-flavored collagen peptides in a 378 g jar. The flavored option in our collagen collection, alongside unflavored Hydrolyzed Collagen Peptides.',
    highlights:['Grass-fed collagen peptides','Chocolate flavor','378 g per jar'],
    title:'Your collagen, in chocolate.',
    story:'The chocolate option brings a different flavor to the IQON collagen collection. It comes as a powder in a 378 g jar. Prefer an unflavored product? You can compare both collagen options below, including the differences in their pack sizes.',
    facts:[fact('Ingredient named','Collagen peptides','Grass-fed collagen is identified on the label.'),fact('Flavor','Chocolate','The flavored option in the collection.'),fact('Net weight','378 g','The total amount of powder in each jar.')],
    faqs:[faq('Is there an unflavored alternative?','Yes. IQON Hydrolyzed Collagen Peptides is the unflavored option, in a 280 g jar.'),faq('How much powder is in the jar?','The chocolate collagen jar has a net weight of 378 g.'),faq('Does it contain sugar or sweeteners?','The full ingredient list and nutrition information are needed to answer that. They will be published before this product becomes available to order.')]
  },
  'colostrum-powder': {
    descriptor:'Colostrum in a compact powder format.',
    description:'Colostrum Powder in a 69 g jar. One of four powders in the IQON supplement collection, alongside creatine and two collagen options.',
    highlights:['Colostrum powder','Compact jar format','69 g net weight'],
    title:'A smaller jar. A different powder.',
    story:'Colostrum Powder is the compact jar in the IQON powder collection. Its 69 g pack sits alongside creatine and collagen, but the product name matters more than the similar format. Compare the products by ingredient and pack size before choosing.',
    facts:[fact('Product','Colostrum','Presented as a powder in the IQON collection.'),fact('Net weight','69 g','The total powder weight in each jar.'),fact('Format','Powder','A compact jar with a screw-top lid.')],
    faqs:[faq('Is colostrum the same as collagen?','No. Colostrum Powder and Collagen Peptides are separate products in the IQON collection.'),faq('How large is this jar?','The net weight of the powder is 69 g.'),faq('Can I see the ingredients and allergen information?','The full formula, allergen information and Supplement Facts panel will be published before orders open.')]
  },
  'colon-gentle-cleanse': {
    descriptor:'Thirty individually packed sachets.',
    description:'Colon Gentle Cleanse is supplied as 30 individual sachets in a resealable jar. Explore the packaging and see how this format differs from loose powder and capsules.',
    highlights:['30 individual sachets','Resealable outer jar','Individually packed format'],
    title:'Individually packed. Kept together.',
    story:'Open the jar to find individual sachets, rather than loose powder. Colon Gentle Cleanse is the sachet format in our supplement collection, with 30 packs kept together in one resealable container.',
    facts:[fact('Pack count','30 sachets','Individual packs inside one jar.'),fact('Format','Sachets','Individually wrapped rather than loose powder.'),fact('Container','Resealable jar','Keeps the individual packs together.')],
    faqs:[faq('Is this loose powder?','No. This product is presented as individual sachets inside a jar.'),faq('How many sachets are included?','Each jar contains 30 sachets. This is a pack count, not a confirmed number of days of use.'),faq('How do I use the sachets?','Preparation and serving directions will be published with the approved product label before orders open.')]
  },
  'keto-5': {
    descriptor:'Keto-5 in a 60-capsule bottle.',
    description:'The capsule format of IQON Keto-5. Each bottle contains 60 capsules. Compare it with the other capsule products in the collection below.',
    highlights:['Keto-5','Capsule format','60 capsules per bottle'],
    title:'Meet Keto-5.',
    story:'Keto-5 is one of the capsule products in the IQON collection. The bottle contains 60 capsules, with a compact shape that carries across the range. Use the product name and the final formula to distinguish it from other products with a similar bottle or capsule count.',
    facts:[fact('Product','Keto-5','An IQON supplement in capsule form.'),fact('Pack count','60 capsules','The total capsule count per bottle.'),fact('Format','Capsules','A bottle format, with no powder to measure.')],
    faqs:[faq('How many capsules are in the bottle?','Each bottle of IQON Keto-5 contains 60 capsules.'),faq('Is this the same as GLP-1 Support?','No. Keto-5 and GLP-1 Support are separate products, even though both are presented in 60-capsule bottles.'),faq('What are the ingredients?','The name alone does not establish the formula. The approved ingredient list and Supplement Facts panel will be published before orders open.')]
  },
  'glp-1-support': {
    descriptor:'GLP-1 Support. Sixty capsules.',
    description:'IQON GLP-1 Support in a 60-capsule bottle. View the packaging, explore the capsule collection and find the available product details below.',
    highlights:['GLP-1 Support','Capsule format','60 capsules per bottle'],
    title:'Get to know the capsule collection.',
    story:'GLP-1 Support is presented in a 60-capsule bottle. It is a separate product from Keto-5 and Liver Support, even though they share a format. The full product label will be the place to check ingredients and directions before choosing.',
    facts:[fact('Product','GLP-1 Support','The product name shown on the IQON label.'),fact('Pack count','60 capsules','The amount of capsules in one bottle.'),fact('Format','Capsules','Part of the IQON capsule collection.')],
    faqs:[faq('Is this a capsule product?','Yes. IQON GLP-1 Support is presented in a bottle of 60 capsules.'),faq('Does the product name mean it contains a GLP-1 medication?','A product name does not establish its ingredients or a medication’s effects. The full approved formula must be checked; this page does not claim equivalence to a prescription medicine.'),faq('Is it a 60-day supply?','The bottle contains 60 capsules. The number of days depends on the final serving directions, which are not yet published.')]
  },
  'liver-support': {
    descriptor:'Liver Support in capsule form.',
    description:'A 60-capsule bottle of IQON Liver Support. Part of our capsule collection, with product photography and pack details available to explore ahead of launch.',
    highlights:['Liver Support','Capsule format','60 capsules per bottle'],
    title:'One bottle in a wider collection.',
    story:'Liver Support comes in the 60-capsule format used across several IQON supplements. The capsule count makes the pack easy to compare; the product name and final formula distinguish what is inside. Explore the details and the neighboring products below.',
    facts:[fact('Product','Liver Support','The name of this IQON supplement.'),fact('Pack count','60 capsules','Capsule count for one bottle.'),fact('Format','Capsules','Presented in a screw-top bottle.')],
    faqs:[faq('How much does the bottle contain?','The pack contains 60 capsules.'),faq('How does this differ from the other capsule products?','It is a separate product with a different name. A comparison of active ingredients or strength requires the final approved formulas.'),faq('Where are the serving directions?','Serving directions and the full Supplement Facts panel will be published before this product is available to order.')]
  },
  'nmn': {
    descriptor:'NMN. Thirty capsules per bottle.',
    description:'The NMN capsule product in the IQON collection. This bottle contains 30 capsules, a smaller pack count than our 60-capsule Resveratrol option.',
    highlights:['NMN','Capsule format','30 capsules per bottle'],
    title:'NMN, in a 30-capsule format.',
    story:'NMN and Resveratrol sit alongside each other in the IQON collection, but they are separate products. NMN contains 30 capsules per bottle. The comparison below makes the different product names and pack counts easy to see.',
    facts:[fact('Product','NMN','The name on this IQON capsule product.'),fact('Pack count','30 capsules','The total capsule count in one bottle.'),fact('Format','Capsules','The 30-capsule option in our collection.')],
    faqs:[faq('Does the bottle contain 30 or 60 capsules?','The NMN bottle contains 30 capsules.'),faq('Is this NMN or resveratrol?','This product is NMN. IQON Resveratrol is a separate product in a 60-capsule bottle.'),faq('What is the amount of NMN per capsule?','An amount per capsule is not confirmed here. It will be shown in the approved Supplement Facts panel before orders open.')]
  },
  'resveratrol': {
    descriptor:'Resveratrol. Sixty capsules per bottle.',
    description:'IQON Resveratrol in capsule form, with 60 capsules in each bottle. Explore it alongside NMN and the rest of the capsule collection.',
    highlights:['Resveratrol','Capsule format','60 capsules per bottle'],
    title:'Resveratrol, clearly identified.',
    story:'Resveratrol has its own place in the IQON capsule collection. Each bottle contains 60 capsules. It is distinct from NMN, which comes in a 30-capsule bottle; compare the two formats below and check the final product label when available.',
    facts:[fact('Product','Resveratrol','The ingredient name used for this IQON product.'),fact('Pack count','60 capsules','The total capsule count per bottle.'),fact('Format','Capsules','Presented in a screw-top bottle.')],
    faqs:[faq('How many capsules are in the bottle?','IQON Resveratrol contains 60 capsules per bottle.'),faq('Is this the same as NMN?','No. They are separate products. NMN is supplied in a 30-capsule bottle, while Resveratrol is supplied in a 60-capsule bottle.'),faq('What is the strength per capsule?','The final Supplement Facts panel will confirm the amount per capsule. Capsule count alone does not establish strength or serving size.')]
  },
  'hair-skin-nails-gummies': {
    descriptor:'Passion fruit flavor. Gummy format.',
    description:'Hair, Skin & Nails Gummies in a bottle of 60. A passion-fruit-flavored alternative to the capsule and powder formats in our supplement collection.',
    highlights:['Passion fruit flavor','Gummy format','60 gummies per bottle'],
    title:'A different format. A little flavor.',
    story:'Hair, Skin & Nails is the gummy product in the IQON collection. The passion fruit flavor and bottle of 60 set it apart from powders and capsules. See the gummies up close, then compare the formats below.',
    facts:[fact('Flavor','Passion fruit','The flavor named on this product.'),fact('Pack count','60 gummies','The total number of gummies in one bottle.'),fact('Format','Gummies','An alternative format to powders and capsules.')],
    faqs:[faq('What flavor are the gummies?','The gummies are passion fruit flavored.'),faq('How many gummies are in each bottle?','Each bottle contains 60 gummies. Serving size and frequency will be confirmed on the final label.'),faq('Are the gummies vegan or sugar-free?','Those details cannot be confirmed from the product name or photograph. The full ingredient and nutrition information will be published before orders open.')]
  },
  'peptide-serum': {
    descriptor:'The serum step in your skincare routine.',
    description:'A 30 mL serum concept for the IQON skincare collection. Designed around the treatment step, between your cleanser and moisturizer.',
    highlights:['Serum concept','Treat step','30 mL format'],
    title:'Between cleanse and cream.',
    story:'Peptide Serum is the treatment step in the proposed IQON skincare routine. The 30 mL dispenser sits alongside Gentle Cleanser and Barrier Cream, giving each product a distinct role. Explore the three-step collection below.',
    facts:[fact('Routine step','02 / Treat','The proposed step between cleansing and moisturizing.'),fact('Format','Serum','Presented in a dispenser bottle.'),fact('Pack size','30 mL','The size of this skincare concept.')],
    faqs:[faq('Where does this serum fit in the routine?','The proposed order is Gentle Cleanser, Peptide Serum, then Barrier Cream. Final application directions will accompany the approved formula.'),faq('Is the formula available yet?','This is a skincare concept. The approved ingredient list, directions and skin-type suitability have not yet been published.'),faq('What size is the serum?','The proposed Peptide Serum format is 30 mL.')]
  },
  'barrier-cream': {
    descriptor:'The moisturizer step. A 50 mL jar.',
    description:'A moisturizer concept for the IQON skincare collection. The final step in our proposed cleanse, treat and moisturize routine.',
    highlights:['Moisturizer concept','Moisturize step','50 mL jar'],
    title:'Finish with your moisturizer.',
    story:'Barrier Cream completes the proposed three-step IQON skincare routine. It follows Gentle Cleanser and Peptide Serum, with a 50 mL jar format. Get to know each step and how the three products sit together.',
    facts:[fact('Routine step','03 / Moisturize','The final step in this proposed three-product routine.'),fact('Format','Cream','Presented in a jar.'),fact('Pack size','50 mL','The size of this skincare concept.')],
    faqs:[faq('Where does the cream fit in the routine?','Barrier Cream is the moisturizing step, after cleansing and the serum step in our proposed routine.'),faq('Is this suitable for sensitive skin?','Skin-type suitability and testing have not been confirmed. Those details will be provided with the approved formula.'),faq('What size is the jar?','The proposed Barrier Cream jar is 50 mL.')]
  },
  'gentle-cleanser': {
    descriptor:'Your first skincare step.',
    description:'A cleanser concept in a 150 mL pump bottle. The starting point for the IQON skincare collection, followed by serum and moisturizer.',
    highlights:['Cleanser concept','Cleanse step','150 mL pump bottle'],
    title:'Begin with your cleanser.',
    story:'Gentle Cleanser is the first product in our proposed skincare routine. The 150 mL pump format sits beside Peptide Serum and Barrier Cream. Each has its own step, from the first cleanse to the final layer.',
    facts:[fact('Routine step','01 / Cleanse','The starting point in the proposed IQON skincare routine.'),fact('Format','Cleanser','Presented in a pump bottle.'),fact('Pack size','150 mL','The size of this skincare concept.')],
    faqs:[faq('Is this the first step in the routine?','Yes. The proposed routine starts with Gentle Cleanser, followed by Peptide Serum and Barrier Cream.'),faq('Does it contain fragrance?','The approved ingredient list is not yet available. Fragrance content and skin-type suitability will be confirmed before launch.'),faq('What size is the cleanser?','The proposed Gentle Cleanser is a 150 mL pump bottle.')]
  }
};
