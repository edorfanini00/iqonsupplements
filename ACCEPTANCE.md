# IQON storefront acceptance ledger

Builder scope implemented. Local verification and baseline comparisons are recorded below and in `docs/qa/premium-site/VERIFICATION.md`. This is a review candidate, not a release. Parent owns two independent reviews of the final PR head and hosted preview approval. No merge or deployment was performed.

Branch: `feat/iqon-premium-site-20261107`. Base: `468996c53d6fde2864a94d1b44a06a6868050335`.

## Boundaries

Prices, inventory, offers, subscriptions, payments, policies, account/OAuth, affiliate attribution, consent and webhooks remain authoritative. No application backend or schema changed. Tests use local synthetic commerce and disposable loopback PostgreSQL, with fake email senders and external browser tracking blocked. Actual product assets are served normally; screenshots do not replace image URLs. The skincare comparison source, assets, controls, disclosures and mount are frozen.

## 1. Credibility and reviews

Implemented. Home and skincare render review marketing only when genuine reviews exist. Product empty states are compact, with no invented stars or counts, including design preview. Unit tests exercise a genuine low rating and its contribution to the average. Coming soon skincare remains unorderable. The existing comparison illustrations and disclosure are preserved exactly. No fake restock form was added: there is no supported restock subscription backend in this repository.

## 2. Homepage opening

Implemented. Consumer proposition is “Make room for feeling your best.” Supporting copy names training, collagen drinks and nutrient formats, with one primary shopping CTA and a quiet Approach link. Existing IQON colostrum packaging is the hero. Real phone/desktop captures verify delivery, readable copy and first paint. Parent narrative corrections are incorporated.

## 3. Homepage sequence

Implemented. Hero, curated three product edit, creatine story with powder detail, grounded format/flavor choices, colostrum editorial preparation scene, education and final collection route. No bestseller or customer endorsement is invented. The feature uses texture instead of another jar; the preparation scene is existing editorial artwork, not documentary evidence of actual mixing.

## 4. Navigation

Implemented. Unqualified “Shop all” links route to `/collections/all`; department shopping links route to their collections. Desktop Explore distinguishes Supplement stories and Skincare preview. Account, bag, search, mobile menu and Escape behavior remain operational. Browser tests cover mobile navigation and existing search, collection routes and URL-backed filters.

## 5. Collection

Implemented. All eighteen products remain browsable. Concrete supplement subtitles, size, format, price, servings where verified, and availability are visible. Search, clearing, empty state, format and sort journeys are tested against the live-mode isolated fixture. Mobile cards use readable type and aligned actions. No medical diagnosis filters were added.

## 6. Product opening

Implemented. Actual DOM sequence is gallery, name, purpose and up to three distinctions, price and serving information, buying controls, then details. The desktop gallery remains left of the buying column. Synthetic variants, unavailable products, generic products, skincare and default packs are covered at 320, 390, 760, 761 and 1440 pixels. Keyboard order follows the DOM; no positive tabindex is used.

## 7. Gallery and assets

Implemented with existing media. Galleries distinguish packaging, product detail, formula focus and use guide. Below the opening, texture imagery and a separate product editorial scene serve different roles. All local images load with nonzero natural dimensions across every product. No supplied asset was altered or generated. Source inventory and generation provenance are in `CONTENT-EVIDENCE.md`. Documentary preparation photography remains a specific future asset need; existing editorial scenes are not described as customer or laboratory evidence.

## 8. Product-specific stories

Implemented. Eleven distinct supplement stories retain their own ingredients, preparation, questions and relevant research. All seven skincare stories remain complete and unorderable. Creatine's training story is preserved; GLP-1 Support does not claim drug equivalence. Recovered label facts correct the prior unknown quantities for collagen, liver ingredients, gummies and probiotic CFU. All eighteen pages receive real-asset browser checks.

## 9. Content density and warnings

Implemented. The opening has a short purpose, no more than three highlights and two serving fields. Colostrum's opening avoids repeating its active amount in every block. Existing full directions remain available in accordions. Recovered collagen and creatine cautions are added; gummies explicitly declare tilapia and coconut, alongside existing facility information. Unflavored collagen supplier and label directions differ in wording; both source versions are recorded rather than silently replacing the existing instructions.

## 10. Evidence

Implemented within documented evidence. Seven ingredient research sections identify what was studied, finding, relevance, limitation and existing source links. They do not claim IQON finished-product trials. Product details use supplied country/contents facts; no new certification or testing badge is added. Eleven recovered supplement panels are transcribed with exact source versions and hashes. They establish printed label facts, not batch assays, expiry guarantees or clinical efficacy. Concrete missing-document requests remain in `CONTENT-EVIDENCE.md` and the recovery delta.

## 11. Buying and value

Implemented. Bundle quantity, per-jar prices and selected totals retain canonical money/offer functions and 2/10%, 3+/25% thresholds. Mix-and-match and discount-code incompatibility remain visible. Cost per labeled serving follows current price/currency; no hardcoded prices or inferred days. Variant/pack guards suppress unsupported costs. Creatine 50 servings is not 50 days; Keto and Resveratrol 60 servings are distinguished from 30 days at twice daily use. Browser tests cover ordinary and loaded keyboard selection, additions, mixed carts, cents, removal, persistence and checkout review/back navigation.

## 12. Visual system

Implemented and inspected. Neutral palette, 22 pixel mobile content gutters, measured 16 pixel mobile/17 pixel desktop product introduction, readable paragraph widths and varied compositions. Existing reference screenshots informed spacing and hierarchy without copied artwork or branding. Current home, collection, product, research and Approach screenshots were visually inspected. Contrast checks cover the new home body copy and existing footer, Help and product text.

## 13. Mobile and accessibility

Implemented and verified. Required widths, gallery keyboard navigation, pointer/keyboard skincare comparison, reduced motion, actual 200% text enlargement and containment are tested. Sticky purchase is suppressed until the inline action has been passed on phones and omitted when ordering is unavailable. Live bundle controls are also checked at doubled text size. A generic-product desktop margin regression found by the expanded matrix was corrected and rechecked.

## 14. Our approach

Implemented. The page explains product formats and purposes, useful information standards, practical preparation and support. It identifies PrismTrade LLC as supplement distributor from recovered labels. No founder narrative, selection qualification or manufacturing certification was invented. Phone and desktop captures verify readability.

## 15. Help

Implemented. Live Help starts with tracking, account access, damaged/incorrect orders and returns. It links existing account and authoritative policy destinations. Bundle terms, product information and actual support email remain available. No response SLA or policy change was added. Preview Help remains explicitly a preview. Live-mode browser checks verify order tasks and policy links.

## 16. Cart and account continuity

Verified using isolated fixtures and real local databases. Mixed bundle thresholds, codes, totals, quantity controls, persistence, review/checkout back path and account integration were exercised. No real order, email or customer mutation occurred. Existing account and affiliate regression failures are reproduced on the exact base and are documented, not represented as passes. Genuine signed-in hosted access remains NOT CHECKED; it requires the parent's authorized preview/customer session. Backend and attribution source files remain unchanged.

## 17. Education and SEO

Implemented and verified. Existing articles and indexed routes remain. Two specific questions explain serving weight versus duration and ingredient versus finished-product research, with relevant existing product links. The production route matrix verifies titles, canonical/noindex boundaries, availability, structured data, no fake ratings and internal links. Old article sections retain their content hashes; tests explicitly account for the two added sections.

## 18. Release quality and measurement

Implemented and locally verified, with explicit baseline limitations. Next production build, direct worker build, TypeScript, meaningful component/unit/integration/browser tests, asset loading, fonts, contrast and layout measurements are recorded in the verification report. Native `npm run build` requires GNU `timeout`, absent on this Mac; the underlying worker build is run directly and succeeds. Existing worker-import and historical parity tests still fail on the base. No new lint errors were introduced. Analytics, consent, purchase deduplication and attribution code are unchanged; browser QA blocks external tracking and uses no production purchase flow. No conversion gains are claimed.

## Remaining release gates and dependencies

- Parent: two independent evidence-backed reviews of the exact final PR head, bounded corrections/re-review if needed, and authorized hosted preview review.
- Real signed-in hosted account/checkout access is not claimed from synthetic tests.
- Supplier: lot-linked assays, relevant facility certificates and scope, ingredient source/processing traceability, expiry viability evidence, and any IQON finished-product studies. Label artwork is not a substitute.
- Keto: total caffeine and component masses remain undisclosed. GLP-1: overlapping blend/nutrient accounting and CFU time basis remain unconfirmed. NMN: stated purity still lacks assay evidence.
- Assets: documentary preparation sequence and any consented customer material are future acquisitions. No unsupported restock signup backend exists.
- Baseline technical debt: precise failed/skipped/cancelled checks and reproductions are listed in the verification report.

Rollback: revert the feature commits. No migration, infrastructure, price, inventory or backend rollback is needed.
