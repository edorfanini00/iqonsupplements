// Shared acceptance checks for article data, server HTML and hydrated browser text.
import assert from "node:assert/strict";

export const otherGuideAnswers = [
  {
    slug: "finding-your-supplement-format",
    heading: "Can I open a capsule if it is hard to swallow?",
    after: "Capsules keep the process compact",
    shot: "capsule_opening",
    source: "https://ods.od.nih.gov/factsheets/WYNTK-Consumer/",
    sourceLabel: "NIH · What you need to know about supplements",
    paragraphs: 2,
    required: [/^It depends on the product\./, /Check its label and directions\./, /do not address opening it, ask the maker or a pharmacist before changing how you use it/, /already sold as a powder or chewable/, /preference/, /not an equivalent formula or dose/],
  },
  {
    slug: "a-simple-skincare-routine",
    heading: "How do I test a new skincare product?",
    after: "Make treatment a purposeful choice",
    shot: "skincare_test",
    source: "https://www.aad.org/public/everyday-care/skin-care-secrets/prevent-skin-problems/test-skin-care-products",
    sourceLabel: "American Academy of Dermatology · How to test skin care products",
    paragraphs: 3,
    required: [/small area before adding it/, /American Academy of Dermatology/, /size of a quarter/, /underside of your arm or inner elbow/, /twice daily for 7 to 10 days/, /usual amount and thickness/, /normally leave on.*usual length of time/, /cleanser.*five minutes or.*label directs.*rinse/, /reaction.*wash.*off.*stop using it/, /severe or does not settle.*dermatologist/, /does not guarantee.*safety.*diagnose an allergy.*show how well/],
  },
];

export function assertGuideAnswer(answer, paragraphs) {
  assert.equal(paragraphs.length, answer.paragraphs, answer.slug);
  const text = paragraphs.join(" ");
  for (const required of answer.required) assert.match(text, required, answer.slug);
  assert.doesNotMatch(answer.heading + text, /[-\u2010-\u2015]/, "new customer copy has no dashes");
  assert.doesNotMatch(text, /\bIQON\b|\bNHS\b|\bFDA\b|absorption|bioavailability/i, "no SKU claims or borrowed medicine rules");
}
