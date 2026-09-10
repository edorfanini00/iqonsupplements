// Layout samples only. Never add these to customerReviews or approvedSkincareResults.
// The server enables them only in development or a Vercel preview deployment.
import type { SkinResult } from "./skincare-results";

const portrait="/images/editorial/skincare-touch-v7.webp";
const skinDetails = [
  { id: "texture", label: "Skin texture", productId: "barrier-cream", headline: "Skin texture. In closer detail.", detail: "An illustrated look at dry and moisturized skin.", area: "macro forearm skin" },
  { id: "cheek", label: "Cheek detail", productId: "barrier-cream", headline: "The small details of skin.", detail: "Explore the surface, from fine texture to natural pores.", area: "fair cheek skin" },
  { id: "tone", label: "Skin tone", productId: "peptide-serum", headline: "Every tone. Every detail.", detail: "A close-up exploration of skin tone and surface texture.", area: "warm-toned cheek skin" },
  { id: "eye", label: "Eye-area detail", productId: "peptide-serum", headline: "A closer look at fine lines.", detail: "Explore the delicate texture around the eye.", area: "the outer eye area" },
];
export const sampleSkinResults: SkinResult[] = skinDetails.map(item => ({
  id: `design-sample-${item.id}`, productId: item.productId, label: item.label,
  before: { src: `/images/editorial/skin-detail-${item.id}-before.webp`, alt: `AI-generated illustration of ${item.area}, before state` },
  after: { src: `/images/editorial/skin-detail-${item.id}-after.webp`, alt: `AI-generated illustration of ${item.area}, simulated after state` },
  headline: item.headline, timeframe: item.detail,
  methodology: "AI-generated skin illustrations. Not clinical photographs or evidence of IQON product results.",
  source: { label: "", url: "" },
  metrics: [
    { value: "Texture", description: "The fine detail of the skin’s surface" },
    { value: "Tone", description: "Natural variations in skin color" },
    { value: "Radiance", description: "The way light meets the skin" },
    { value: "Fine lines", description: "The delicate contours of the skin" },
  ],
  approvedForPublication: false, photographyConsentConfirmed: false,
}));

export type SampleReviewCard={id:string;title?:string;image?:string;alt?:string};
export const sampleReviewCards:SampleReviewCard[]=[
 {id:"serum",image:"/images/editorial/skincare-hands-v7.webp",alt:"IQON editorial photograph of Peptide Serum held in the hands"},
 {id:"ritual",title:"A few essentials. A moment for you."},
 {id:"daily",title:"A little care. Every day."},
 {id:"touch",image:portrait,alt:"IQON editorial portrait of a woman applying cream"},
 {id:"collection",image:"/images/editorial/skincare-campaign-mobile.webp",alt:"IQON editorial still life of skincare products"},
 {id:"rhythm",title:"Find your skincare rhythm."},
 {id:"moment",title:"Make a little time for you."},
 {id:"essentials",image:"/images/store/campaign-skincare.webp",alt:"The IQON skincare collection, photographed for the brand"},
];
