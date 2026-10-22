export type JournalArticle={slug:string;title:string;dek:string;category:string;readTime:string;image:string;imageAlt:string;sections:{heading:string;paragraphs:string[];format?:string;products?:string[]}[];sources?:{label:string;url:string}[]};
/** `format` (a Shopify product type) and `products` (handles) name the products a section discusses. The article
 * links only those a shopper can order now; each product page links back to the guide that discusses it. */
export const journalArticles:JournalArticle[]=[
  {
    "slug": "reading-a-supplement-label",
    "title": "Read the label with confidence.",
    "dek": "A few details make a supplement easier to understand, compare and choose.",
    "category": "UNDERSTANDING SUPPLEMENTS",
    "readTime": "3 MIN READ",
    "image": "/images/editorial/news-reading-labels-iqon-v11.webp",
    "imageAlt": "The IQON NMN label and capsule bottle on a cool silver surface",
    "sections": [
      {
        "heading": "Begin with the full name",
        "products": ["creatine-monohydrate"],
        "paragraphs": [
          "The front of a bottle introduces a product. The full label gives you a closer look. Start with the ingredient name and its form: creatine monohydrate, for example, is more specific than creatine alone. Then find the Supplement Facts panel. Reading these details in the same order each time can make an unfamiliar label feel much easier to navigate."
        ]
      },
      {
        "heading": "Find the serving size first",
        "paragraphs": [
          "The amounts in a Supplement Facts panel are usually presented per serving. A serving can contain more than one capsule or gummy, so begin at the top of the panel before comparing the numbers below. As a simple example, a bottle of 60 capsules with a serving size of two contains 30 servings. How long it lasts also depends on the directions for frequency of use."
        ]
      },
      {
        "heading": "Give the numbers their context",
        "products": ["colostrum-powder"],
        "paragraphs": [
          "Read the unit beside each amount. Grams, milligrams and micrograms describe different scales: one gram equals 1,000 milligrams. The percentage Daily Value, where provided, places a nutrient amount against a reference value. Some dietary ingredients have no established Daily Value, which the panel identifies. For blends, check whether an amount applies to an individual ingredient or to the blend as a whole."
        ]
      },
      {
        "heading": "Does a 600 mg blend mean 200 mg of each ingredient?",
        "paragraphs": [
          "No, a 600 mg proprietary blend with three ingredients does not necessarily contain 200 mg of each.",
          "In a hypothetical Supplement Facts panel, a proprietary blend totaling 600 mg lists ingredients A, B and C, with no Daily Values established. The 600 mg is their combined weight per serving. FDA requires these blend ingredients to appear in descending order by weight, but does not require their individual weights. Ingredients with established Daily Values must be listed separately with their own amounts.",
          "Do not divide the total equally or infer exact amounts from the ingredient order. When comparing labels, look for a separately stated amount per serving for the ingredient you want to compare. If only the blend total is given, mark that ingredient's amount as undisclosed instead of guessing. See question 34 in FDA's Dietary Supplement Labeling Guide, Chapter IV, linked under Further reading."
        ]
      },
      {
        "heading": "Meet the rest of the formula",
        "products": ["hydrolyzed-collagen-peptides", "collagen-peptides-chocolate"],
        "paragraphs": [
          "Read the ingredient statement alongside the facts panel. It can include components such as the capsule shell, flavorings and sweeteners. These details matter when taste, allergies or dietary preferences influence your choice. An unflavored option, for instance, is a flavor description; the ingredient list tells you the rest. Storage and preparation directions are also worth reading before finding a place for the product at home."
        ]
      },
      {
        "heading": "Make a comparison you can use",
        "paragraphs": [
          "Put two labels side by side and compare the same things: ingredient form, amount per serving, servings per container and the full ingredient list. If you are comparing prices, cost per serving can be more useful than the price of the bottle alone. Keep a record of the supplements you use, including their amounts and frequency. It gives you a clear reference when shopping again or discussing your routine with a health professional."
        ]
      }
    ],
    "sources": [
      {
        "label": "FDA · Reading Supplement Facts",
        "url": "https://www.fda.gov/food/dietary-supplements-guidance-documents-regulatory-information/dietary-supplement-labeling-guide-chapter-iv-nutrition-labeling"
      },
      {
        "label": "FDA · Ingredient labeling",
        "url": "https://www.fda.gov/food/dietary-supplements-guidance-documents-regulatory-information/dietary-supplement-labeling-guide-chapter-v-ingredient-labeling"
      },
      {
        "label": "NIH · What you need to know about supplements",
        "url": "https://ods.od.nih.gov/factsheets/WYNTK-Consumer/"
      }
    ]
  },
  {
    "slug": "finding-your-supplement-format",
    "title": "Find a format that fits.",
    "dek": "From a measured powder to a portable capsule, the practical details can shape a routine.",
    "category": "EVERYDAY ROUTINES",
    "readTime": "3 MIN READ",
    "image": "/images/editorial/daily-water-v24.webp",
    "imageAlt": "An adult pouring water into a glass at home",
    "sections": [
      {
        "heading": "Picture an ordinary day",
        "paragraphs": [
          "Think about where a supplement would live in your day. Do you usually have breakfast at home? Leave early with a bag already packed? Prefer a drink to swallowing capsules? Those small preferences are useful information. Once you have identified an appropriate product and understood its ingredients, format becomes a practical choice about preparation, taste, portability and the space it takes up."
        ]
      },
      {
        "heading": "Powders make preparation part of the ritual",
        "format": "Powder",
        "paragraphs": [
          "A powder asks for a little time and a place to prepare it. You may need a measuring tool, a suitable liquid and a glass or shaker, depending on the product's directions. That can suit someone who enjoys a familiar kitchen routine. Flavor is another part of the decision: consider what you genuinely enjoy drinking and follow the specified measuring and mixing instructions."
        ]
      },
      {
        "heading": "Capsules keep the process compact",
        "format": "Capsules",
        "paragraphs": [
          "Capsules remove the measuring and mixing steps. Their size and the number in a serving are still worth considering, especially if swallowing capsules feels inconvenient. Read the directions for timing and whether the product should be taken with food. A compact bottle may work well in a busy day, provided you can store it according to the label and keep its instructions close."
        ]
      },
      {
        "heading": "Can I open a capsule if it is hard to swallow?",
        "paragraphs": [
          "It depends on the product. Check its label and directions. If they do not address opening it, ask the maker or a pharmacist before changing how you use it.",
          "A product already sold as a powder or chewable may suit your preference. It is a different product, not an equivalent formula or dose, so read its own ingredients and directions before choosing."
        ]
      },
      {
        "heading": "Sachets are easy to take along",
        "format": "Sachets",
        "paragraphs": [
          "Individual packets make it convenient to carry a few sachets without the full outer container. They can suit a trip, an office drawer or a bag, within the product's storage requirements. Preparation varies: a packet may still call for water, a cup or another step. Consider that whole process when comparing convenience. Keep the product name and directions available, especially when leaving the outer packaging at home."
        ]
      },
      {
        "heading": "Gummies put taste and texture first",
        "format": "Gummies",
        "paragraphs": [
          "A gummy offers a chewable option with its own flavor and texture. Read the serving size and look at the ingredients used for sweetness and structure, including any details relevant to your dietary preferences. Across formats, the most useful comparison brings the formula and the experience together. Choose something you can prepare and use as directed on an ordinary day, with a taste, texture and amount of preparation that feels comfortable."
        ]
      }
    ],
    "sources": [
      {
        "label": "NIH · What you need to know about supplements",
        "url": "https://ods.od.nih.gov/factsheets/WYNTK-Consumer/"
      }
    ]
  },
  {
    "slug": "a-simple-skincare-routine",
    "title": "A few steps. A moment for you.",
    "dek": "Give cleansing, treatment, moisture and sun protection a clear place in your day.",
    "category": "SKINCARE NOTES",
    "readTime": "3 MIN READ",
    "image": "/images/editorial/skincare-ritual-v26.webp",
    "imageAlt": "A woman applying cream to her cheek while holding IQON Copper Peptide Restore Cream",
    "sections": [
      {
        "heading": "Start with a routine you understand",
        "paragraphs": [
          "A well-considered skincare routine gives each product a clear job. Cleansing, moisturizing and daytime sun protection provide a straightforward place to begin. A serum or treatment can be added for a specific purpose. Before adding another layer, ask what you want it to do and how it fits with the products you already enjoy using. A manageable sequence leaves room to pay attention to your skin."
        ]
      },
      {
        "heading": "Cleanse with a gentle touch",
        "paragraphs": [
          "For a rinse-off cleanser, use lukewarm water and apply with your fingertips, following the product's directions. Gentle movements are enough; avoid turning cleansing into a vigorous scrub. Rinse and pat dry with a soft towel. The American Academy of Dermatology recommends gentle cleansing and generally limiting face washing to twice a day, with another wash after heavy sweating."
        ]
      },
      {
        "heading": "Make treatment a purposeful choice",
        "paragraphs": [
          "A serum is an optional step with a role defined by its formula. Begin with the ingredient information and intended use, then follow the application instructions. If it is meant to go between cleanser and moisturizer, give it that place in the sequence. A short note about when you introduced a product can help you keep track of your routine as it changes."
        ]
      },
      {
        "heading": "How do I test a new skincare product?",
        "paragraphs": [
          "Try it on a small area before adding it to your routine. The American Academy of Dermatology recommends a spot about the size of a quarter on the underside of your arm or inner elbow. Apply your usual amount and thickness twice daily for 7 to 10 days.",
          "For a product you normally leave on, keep it there for the usual length of time. For a cleanser you wash off, wait five minutes or as long as its label directs, then rinse.",
          "If you notice a reaction, gently wash the product off and stop using it. If the reaction is severe or does not settle, consult a dermatologist. This check does not guarantee a product's safety, diagnose an allergy or show how well it works. See the AAD instructions under Further reading."
        ]
      },
      {
        "heading": "Choose a moisturizer you like using",
        "paragraphs": [
          "Texture matters in a product you reach for regularly. A cream, lotion or gel can feel quite different on application, so consider both the skin types a product is designed for and the finish you prefer. Follow its directions for application. You might enjoy a richer-feeling layer in the evening and something that sits comfortably beneath your daytime products in the morning."
        ]
      },
      {
        "heading": "Give mornings a sun protection step",
        "paragraphs": [
          "Make room for sunscreen in your morning routine. The American Academy of Dermatology recommends a broad-spectrum, water-resistant sunscreen with SPF 30 or higher. Broad spectrum refers to protection from UVA and UVB rays. Follow the sunscreen's application and reapplication directions, and use shade and protective clothing when outdoors. A moisturizer provides sun protection only when its label specifically identifies it as an SPF product; check those details when planning your morning sequence."
        ]
      }
    ],
    "sources": [
      {
        "label": "American Academy of Dermatology · Face washing 101",
        "url": "https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101"
      },
      {
        "label": "American Academy of Dermatology · How to select sunscreen",
        "url": "https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-select-sunscreen"
      },
      {
        "label": "American Academy of Dermatology · How to test skin care products",
        "url": "https://www.aad.org/public/everyday-care/skin-care-secrets/prevent-skin-problems/test-skin-care-products"
      }
    ]
  }
];
