# Timeline reference audit for IQON

Working research notes, 10 September 2026. Source site: https://www.timeline.com. IQON implementation source, per task: `edorfanini00/iqonsupplements`. No Site, repository, checkout, cart, account, or external form was changed during this audit.

## Coverage and limits

This is a structural and content audit of the public US storefront. It covers the two homepages, active catalog collection routes, all 18 product pages linked from those catalogs, science/benefits/mechanism/studies/patents, both About routes, reviews/testimonials, journal categories and three representative articles, FAQ, help-center categories, refund/subscription articles, contact, rewards, affiliate landing page, and the quiz entry screen.

All 18 catalog-linked PDPs were opened through web retrieval and their product body content was inspected. Live browser inspection additionally covered the supplement homepage, skincare homepage, skincare shop, vegan-softgels PDP, firming-serum PDP, hydrated offer controls, sticky purchase bars, newsletter overlay, and the clinical study drawer. Web extraction is weaker for client-rendered prices, purchase options, carousels, and embedded clinician reviews; those were cross-checked in the browser on representative PDPs.

Mobile rendering was **not verified**: the supported cloud browser API exposed no viewport-resize/device-emulation capability. Mobile suggestions below are implementation recommendations, not claims about Timeline's observed mobile behavior. No checkout, order, account, newsletter submission, complete quiz, every review, every historic article, podcast episode, or all external studies were tested/read. Review counts and promotions changed slightly between fresh and cached fetches; do not freeze them as timeless facts. No scientific efficacy evaluation was performed; this audit describes the site's presentation of its claims.

## Highest-value lessons for IQON

1. Give supplements and skincare distinct entry points while keeping one coherent brand shell. Adapt the architecture to IQON's real catalog instead of reproducing Timeline's route count.
2. Make each PDP complete: media, one clear proposition, factual product specifications, actual options and price, usage, ingredients, supporting evidence, relevant reviews, FAQs, and a route back to the collection.
3. Link product claims to a structured evidence record with population, dose/form, duration, method, endpoint, source, and limitations. Identify whether evidence concerns an ingredient or the finished product. Use IQON's substantiated information only.
4. Explain selection through useful comparisons. Timeline compares supplement formats by dose/serving/flavor and skincare products by routine step and concern. IQON can make the buying decision easier without copying competitor superiority tables.
5. Treat support and education as real destinations: usable FAQ, contact path, shipping/returns/subscription information, searchable journal, and ingredient explanations.
6. Preserve the restrained visual hierarchy: confident type, high-quality product/editorial media, generous white space, fine rules, consistent badges, and visible calls to action. Keep IQON's own palette, packaging, voice, and identity.

## Global navigation and visual system

The desktop shell has a Supplements/Skincare segmented control at upper left, a centered wordmark, country/account/search/bag utilities at upper right, and a second row of primary navigation. The live supplement row is Shop, Science, About, Longevity Game. Skincare is Shop, Science, Explore, and an outlined Skin Longevity Quiz action. Dropdown content combines short link lists with visual product or article cards. The footer repeats the information architecture and offers help, email, phone, rewards, affiliate/wholesale, newsletter, country, socials, policies, and payment logos. [Supplement homepage](https://www.timeline.com/), [Skincare homepage](https://www.timeline.com/skincare)

Observed desktop styling: nearly white/cream background; charcoal text; restrained muted red promotions; small uppercase utility/nav labels; thin separators, including dotted rules; modest corner radii; white or dark rectangular buttons. Sans-serif headings and UI contrast with serif explanatory prose. Computed text styles in the skincare header used Suisse Intl. Hero media sits almost edge-to-edge inside a narrow outer margin with left-aligned white copy, a compact CTA, and proof/commerce on the right. The supplement hero uses human/product footage; skincare uses organic/microscopic footage and a floating product card. A compact rating strip immediately follows each hero. These observations come from actual desktop screenshots, not inferred source markup.

The supplement PDP uses roughly two-thirds of the page for a two-column image/video mosaic and one-third for the offer panel. Its title gives the product format prominence and the ingredient descriptor a lighter color. Ratings, a guarantee pill, serif overview, and short benefit bullets precede subscription choices. The skincare PDP follows the same visual grammar and adds before/after media and routine context. Live views also showed a floating bottom purchase bar and a two-column newsletter discount modal. These devices keep commerce accessible but add interruption risk; IQON should use them sparingly.

## Homepage and collection patterns

The supplement homepage moves from proposition and rating proof to an editorial introduction, research statistics, benefit tabs with study detail actions, a comparison table, product cards, community content, and expert profiles. The skincare homepage prioritizes its range, before/after selectors with clinical versus consumer results, dermatologist/expert profiles, reviews, material/research credentials, then bestseller and quiz links. [Supplement homepage](https://www.timeline.com/), [Skincare homepage](https://www.timeline.com/skincare)

The supplement shop has three main formats and a practical table comparing the same daily active amount, serving count, sugar, flavor, and certifications. Samples are a lower-commitment alternative. Accessories currently contain one T-shirt. [Shop](https://www.timeline.com/shop), [Samples](https://www.timeline.com/shop/samples), [Accessories](https://www.timeline.com/shop/bundles)

Skincare's shop uses a large page title, an extensive left category/concern rail, editorial media, and product cards. The main collection adds research, an ingredient comparison, a four-step routine table, reviews, and discovery sizes. Category pages are shorter variations with a contextual image/intro and relevant products; concern pages pair curated products with a short concern explanation. [Skincare shop](https://www.timeline.com/skincare/shop)

### Accessible collection inventory

All URLs below were opened. Product selections were inspected; they reflect this audit date.

| Collection | URL | Observed selection or purpose |
|---|---|---|
| Supplements | https://www.timeline.com/shop | Gummies, softgels, powder; comparison and samples |
| Samples | https://www.timeline.com/shop/samples | Three supplement sample formats |
| Accessories | https://www.timeline.com/shop/bundles | T-shirt |
| Skincare all | https://www.timeline.com/skincare/shop | Six full-size skincare products |
| Bestsellers | https://www.timeline.com/skincare/shop/bestsellers | Serum, eye cream, barrier cream |
| New | https://www.timeline.com/skincare/shop/new-products | Discovery sizes featured |
| Travel sizes | https://www.timeline.com/skincare/shop/travel-sizes | Five discovery-size products |
| Cleanser | https://www.timeline.com/skincare/shop/cleanser | Gentle cleanser |
| Exfoliator | https://www.timeline.com/skincare/shop/exfoliator | Resurfacing exfoliator |
| Serum | https://www.timeline.com/skincare/shop/serum | Firming serum |
| Moisturizer | https://www.timeline.com/skincare/shop/moisturizer | Barrier and dewy creams |
| Eye cream | https://www.timeline.com/skincare/shop/eye-cream | Eye cream |
| Dryness | https://www.timeline.com/skincare/shop/dryness | Cleanser, serum, dewy and barrier creams |
| Wrinkles | https://www.timeline.com/skincare/shop/wrinkles | Exfoliator, serum, both creams, eye cream |
| Puffiness | https://www.timeline.com/skincare/shop/puffiness | Eye cream |
| Firmness | https://www.timeline.com/skincare/shop/firmness | Serum, both creams, eye cream |
| Pores/texture | https://www.timeline.com/skincare/shop/pores | Exfoliator, serum, cleanser |
| Hyperpigmentation | https://www.timeline.com/skincare/shop/hyperpigmentation | Eye cream, serum, barrier cream |
| Sensitivity | https://www.timeline.com/skincare/shop/sensitivity | Cleanser, serum, both creams, eye cream |

## All 18 active catalog-linked product pages

These are inspected pages, not products inferred from old blog references. Each name below links directly to the page that supports its entry.

| Product | Distinguishing body content |
|---|---|
| [Gummies](https://www.timeline.com/products/mitopure-gummies) | Sugar-free strawberry format; two gummies per daily serving |
| [Vegan softgels](https://www.timeline.com/products/mitopure-softgels-vegan) | Two daily softgels; 60-softgel monthly package |
| [Powder](https://www.timeline.com/products/mitopure-powder) | Berry stickpack mixed into food; one daily sachet |
| [Gummies sample](https://www.timeline.com/products/mitopure-gummies-sample) | Three-serving trial; same ingredient education |
| [Softgels sample](https://www.timeline.com/products/mitopure-softgels-sample-vegan) | Three-serving vegan trial |
| [Powder sample](https://www.timeline.com/products/mitopure-powder-sample) | Three stickpacks; food-integration guidance |
| [Gentle cleanser](https://www.timeline.com/skincare/products/gentle-cleanser) | Barrier-oriented cleansing; ceramides, humectants, niacinamide; control comparison |
| [Resurfacing exfoliator](https://www.timeline.com/skincare/products/resurfacing-exfoliator) | Leave-on acid treatment; evening frequency and follow-on routine |
| [Firming serum](https://www.timeline.com/skincare/products/firming-serum) | Peptides and hydration system; before/after and participant-specific result |
| [Dewy cream](https://www.timeline.com/skincare/products/dewy-cream) | Lightweight hydration proposition; AM/PM application |
| [Barrier cream](https://www.timeline.com/skincare/products/barrier-cream) | Richer restorative/barrier proposition; detailed complementary actives |
| [Eye cream](https://www.timeline.com/skincare/products/eye-cream) | Eye-area concerns; included cryo spoon and application steps |
| [Cleanser mini](https://www.timeline.com/skincare/products/gentle-cleanser-mini) | Discovery-size version of the cleanser template |
| [Exfoliator mini](https://www.timeline.com/skincare/products/resurfacing-exfoliator-mini) | Discovery-size version of the exfoliator template |
| [Serum mini](https://www.timeline.com/skincare/products/firming-serum-mini) | Discovery-size version of the serum template |
| [Barrier cream mini](https://www.timeline.com/skincare/products/barrier-cream-mini) | Discovery-size version of the barrier template |
| [Dewy cream mini](https://www.timeline.com/skincare/products/dewy-cream-mini) | Discovery-size version of the dewy template |
| [Timeline T-shirt](https://www.timeline.com/products/timeline-tshirt) | Apparel gallery and short cotton/unisex description |

### Supplement PDP mechanics

The inspected hydrated softgels panel offered 1-, 2-, 4-, and 12-month subscriptions, with four months selected and marked as recommended. Options show savings, monthly equivalent, total charge, and comparison price; the selected choice spells out delivery cadence and cancellation flexibility. Add to cart is dominant, with one-time purchase secondary, shipping information, guarantee, and a sample alternative. Below come benefits/ingredients/usage accordions, comparison, clinical tabs, a staged results timeline, certification logos, clinician and customer reviews, FAQ, and related formats. [Softgels](https://www.timeline.com/products/mitopure-softgels-vegan), [Gummies](https://www.timeline.com/products/mitopure-gummies), [Powder](https://www.timeline.com/products/mitopure-powder)

### Skincare PDP mechanics

The serum's hydrated panel offers full/discovery sizes with volume and actual price before Add to cart; nearby routine cards allow relevant cross-shopping. Product-specific galleries combine packaging, texture/use, benefits, before/after, ingredient, and review media. Repeated sections separate the proprietary ingredient from complementary actives, expose the full ingredient list, give application instructions, distinguish clinical from consumer results, and explain where the product fits in a routine. The routine table lists step, frequency, instructions, and product actions. Related products and FAQs finish the story. [Serum](https://www.timeline.com/skincare/products/firming-serum), [Cleanser](https://www.timeline.com/skincare/products/gentle-cleanser), [Eye cream](https://www.timeline.com/skincare/products/eye-cream)

## Science and trust routes

| Inspected route | Structural role |
|---|---|
| [Science](https://www.timeline.com/science) | Accessible cellular explanation, age-related problem, benefit evidence, research credibility |
| [How it works](https://www.timeline.com/science/how-it-works) | Sequential mechanism narrative with clock/cell/food imagery and usage timeline |
| [Benefits](https://www.timeline.com/benefits) | Four outcome sections with metric, journal marker, scientist video, and study detail action |
| [Studies](https://www.timeline.com/studies) | Clinical/preclinical separation; rows for title, status, journal, summary, paper/blog links |
| [Patents](https://www.timeline.com/patents) | Country-grouped identifiers, distinct from efficacy evidence |
| [Skincare science](https://www.timeline.com/skincare/science) | Topical mechanism; skin-specific outcomes; explicitly identifies some preclinical findings |
| [Skincare benefits](https://www.timeline.com/skincare/benefits) | Renewal, wrinkles, collagen, photodamage outcome sections |
| [Ingredients](https://www.timeline.com/skincare/ingredients) | Seventeen-entry jump list; image, role tags, concise explanation, products using it |
| [About](https://www.timeline.com/about) | Mission, origin, research metrics, dated company timeline, leadership/advisors |
| [Skincare About](https://www.timeline.com/skincare/about) | Shared company story inside skincare navigation |

The live study action opens a drawer rather than leaving the PDP. It includes an introduction/methods/results table of contents, study-design badges, journal marker, population/dose/duration details, and a results chart. This is a particularly useful IQON pattern because it keeps the claim and its context adjacent. The registry is a separate deeper destination. The ingredient hub is also a conversion aid: educational entries link back to products using the ingredient rather than ending in isolated prose.

## Reviews and testimonials

[Reviews](https://www.timeline.com/reviews) and [Skincare reviews](https://www.timeline.com/skincare/reviews) expose aggregate rating/distribution plus product, rating, age, and media filters. PDP reviews additionally show recommendation rate and, for supplements, self-reported fitness/energy measures. Review cards include verification, reviewer context, product, date, text, and helpfulness controls; pagination was observed. [Testimonials](https://www.timeline.com/testimonials) is a curated expert page split into scientists/doctors/longevity experts and fitness experts, with names, credentials, images, and quotes. These are different content types and should remain distinguishable in IQON. Do not seed IQON with Timeline's people, reviews, ratings, affiliations, or claims.

## Journal architecture

The [blog index](https://www.timeline.com/blog) combines category navigation, search, featured content, an essential-reading list, and recent image cards with dates/categories; further cards load through Show more. Inspected category destinations: [News](https://www.timeline.com/blog/news), [Nutrition](https://www.timeline.com/blog/nutrition), [Skincare](https://www.timeline.com/blog/skincare), [Studies](https://www.timeline.com/blog/studies), and [Podcasts](https://www.timeline.com/podcasts). Podcasts use durations, hosts, summaries, and an essential-listening list.

Three representative article templates were inspected: [Mitochondria explainer](https://www.timeline.com/blog/five-reasons-to-love-your-mitochondria), [Mitopure user guide](https://www.timeline.com/blog/mitopure-user-guide), and [Dewy versus Barrier Cream](https://www.timeline.com/blog/selecting-between-dewy-cream-and-barrier-cream). Articles show category, publication/update date, substantial headline/deck, hero, contents navigation, key takeaways, author section, inline references, reference list, and contextual product/related links. The user guide integrates shoppable product blocks; the moisturizer comparison resolves a genuine buying question. Historic posts beyond these samples and individual podcast episodes were not audited.

## FAQ, support, and retention inventory

| Inspected URL | Observed role |
|---|---|
| https://www.timeline.com/faq | Eight topic groups: company, ingredient, use/dose, safety, evidence, quality, skincare, purchasing |
| https://help.timeline.com/en-US | Search, tracking entry, four help categories, contact and business hours |
| https://help.timeline.com/en-US/articles/product-93155 | Twenty-one product help articles |
| https://help.timeline.com/en-US/articles/orders-93156 | Eight order/payment/subscription articles |
| https://help.timeline.com/en-US/articles/shipping-93157 | Four shipping articles |
| https://help.timeline.com/en-US/articles/health-care-practitioners-382888 | Seven practitioner-network articles |
| https://help.timeline.com/en-US/contact | Name/email/subject/message form and attachments; no submission performed |
| https://help.timeline.com/en-US/can-i-get-a-refund-323575 | Guarantee conditions, request timing, contact, article feedback |
| https://help.timeline.com/en-US/How-do-I-pause-or-cancel-my-subscription-330777 | Account/manage-subscription instructions and support fallback |
| https://www.timeline.com/skincare/routine | Personalized quiz entry and incentive; later steps not entered |
| https://www.timeline.com/longevityclub | Join/earn/redeem explanation, membership comparison, perks, FAQ |
| https://www.timeline.com/pages/affiliate-program | Separate community/HCP program explanations, signup destinations, science/contact |

Header/footer links also expose https://pro.timeline.com, https://amazentis.com, https://play.timeline.com, account access, privacy, terms, and external social channels. Those destinations were discovered, not audited end to end. Neither an authenticated customer flow nor an external partner application was attempted.

## Gaps and cautionary lessons visible on Timeline

- Repeated research statistics are inconsistent across page families. The homepage mentions 25 trials and over 2,000 participants; About and skincare shop mention 25 and over 900; the skincare homepage's lower credentials mention 11 trials and 56 patents while prominent shared sections state 80 patents. These may reflect differing scope or stale components, but the page copy does not consistently reconcile them. IQON should store shared facts centrally and label their scope. [Home](https://www.timeline.com/), [About](https://www.timeline.com/about), [Skincare](https://www.timeline.com/skincare)
- The studies registry labels published articles as ongoing and contains some unusual outbound destinations, including an X link labelled as a paper. A clean evidence schema should separate enrollment status, publication status, publication date, and canonical paper URL. [Studies](https://www.timeline.com/studies)
- Some product and support wording appears older than the main site: the support product category still references a protein product that is absent from the active catalogs, and some PDP educational copy says 15 years where the main story says 18. Treat only the current catalog as the active inventory. [Product help](https://help.timeline.com/en-US/articles/product-93155), [Gummies](https://www.timeline.com/products/mitopure-gummies)
- On skincare, the same aggregate review total appears on the general and skincare reviews pages, so category scope needs clarification. Product-specific evidence and reviews should be explicitly scoped in IQON. [Skincare reviews](https://www.timeline.com/skincare/reviews)
- Hydrated prices and controls arrived after the initial browser state, and third-party clinician frames plus promotional overlays add complexity. IQON should keep essential title, price, option state, and primary action stable and readable during loading. This is an observation of this browser session, not a measured performance score.
- The long reference content sometimes includes formatting debris and duplicate citation destinations. IQON's journal should validate links and editorial metadata as part of content maintenance. [Mitochondria article](https://www.timeline.com/blog/five-reasons-to-love-your-mitochondria)

## Mobile implementation recommendations, not verified Timeline behavior

- Keep the two category entry points obvious in a compact header; make expanded menus keyboard-operable, closable, and scrollable without hiding the close control.
- Use a swipeable product gallery with visible position controls, then title/price/options/action in a predictable reading order.
- Give subscription/size options full-width touch targets; show total charge and delivery cadence beside the selection; keep the chosen value when opening an evidence drawer or returning from cart.
- Convert category rails into an accessible filter sheet or compact expandable list with visible selected filters and result counts.
- Turn wide comparisons into labelled horizontal tables or stacked comparisons; never squeeze all columns into illegible type.
- Keep sticky purchase bars clear of safe areas, consent widgets, and expanded dialogs. Avoid simultaneous sticky chrome and intrusive discount overlays.
- Respect reduced motion; load nonessential videos and review integrations after core commerce content; maintain a readable poster frame and adequate contrast.
- Test actual small viewports, keyboard focus, accordion state, zoom, empty search results, sold-out variants, cart edits, and long product names in the IQON implementation.

