# Timeline phone-commerce lessons for IQON — v5

10 September 2026. **Use the supplied phone screenshots as the primary visual brief: large products, readable names, and immediate buying actions.**

## Observed in the user's actual phone screenshots

| Evidence | What is visible | Concrete IQON application |
|---|---|---|
| `IMG_8661.PNG` | Large two-line heading; horizontal carousel with one approximately 76–78vw card and next-card peek. Approximately 4:5 image, strong product name, rating, one descriptor, price/volume, and card-width dark button. | Place this large-card shopping treatment immediately after a short hero. Use substantial real packaging, product names, short benefits, price/size, and strong actions. |
| `IMG_8662.PNG` | Near-edge-to-edge serum macro, large three-line proposition and one dark science CTA; almost no prose. | Replace the long editorial introduction with one large photograph, one short proposition and one action. |
| `IMG_8663.PNG` | Large before/after treatment, drag affordance, attached product thumbnail/name, four visual selectors and prominent clinical-results heading. | Attach substantiated evidence to a named IQON product. Ingredient/usage evidence can serve this role if genuine before/after material is unavailable. |
| `IMG_8664.PNG` | Tall video review, large play icon, neighboring-card peeks, concise identity and wide outlined reviews CTA. | Put a few authentic visual testimonials below products. |
| `IMG_8665.PNG` | Near-full-width range photograph, large white shopping headline/link; next lifestyle tile begins almost immediately. | Use a substantial IQON range/bestseller tile with visible shopping action. Avoid tall text-only gaps between commerce modules. |

These are actual phone visual observations; screenshot interactions and exact routes were not tested. The five filenames above identify the user-supplied references.

## Live desktop and responsive-CSS checks

- **Discovery:** [Desktop Shop menu](https://www.timeline.com/) exposes named Gummies/Softgels cards with image, descriptor and price, alongside Shop all/Samples/Accessories. [Shop](https://www.timeline.com/shop) starts with products before explanation. Its supplement grid CSS creates two columns below 768px; this differs from the screenshot carousel.
- **Phone header evidence:** Live CSS below 960px makes Supplements/Skincare a full first row; a menu control, centered logo and utilities form the second row. The desktop navigation row and header Search/Account hide. The opened phone menu itself was not captured.
- **PDP hierarchy:** [Softgels](https://www.timeline.com/products/mitopure-softgels-vegan) and [serum](https://www.timeline.com/skincare/products/firming-serum) place name, rating, guarantee, short summary, benefits, options and buying action before deeper education. Benefits/ingredients/usage start collapsed on inspected desktop pages. Below 960px, CSS stacks the offer and hides the desktop mosaic; the replacement gallery was not live-rendered.
- **Persistent buying/comparison:** Desktop softgels has a “Subscribe & Save” bar; CSS fixes it to the bottom. Mobile appearance remains inferred. Format comparison covers dose, serving, sugar, flavor and certification. The desktop table hides below 768px; its replacement was not established.

## Priority implementation decisions

1. Put **actual product names directly in IQON's Shop menu**. One tap on a name opens its PDP; a format choice must not be a mandatory intermediate step. Keep Shop all available.
2. Use 76–82vw homepage product cards, 4:5 imagery, readable names and card-width actions. Keep a visible route to the complete catalog.
3. Keep the phone PDP compact: gallery, name, one-sentence purpose, three factual highlights, price/size, options and full-width action. Put long science, usage and FAQs below it.
4. Show a compact sticky action after the main action leaves view, preserving variant and price. Compare actual IQON formats through short labelled cards or a decision table.

**Method/limits:** Supported browser inspection ran at 1363×936 CSS px, DPR 1. Control+plus and Control+= did not change it. Phone evidence comes from the five user screenshots, not simulated captures. No checkout, cart, account, form or IQON source changed. Only the research tab was opened and closed.
