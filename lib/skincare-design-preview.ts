// Layout samples only. Never add these to customerReviews or approvedSkincareResults.
// The server enables them only in development or a Vercel preview deployment.
import type { SkinResult } from "./skincare-results";

const portrait="/images/editorial/skincare-touch-v7.webp";
const skinDetails = [
  { id: "texture", label: "Skin texture", productId: "barrier-cream", headline: "Your skin. In its best light.", detail: "Texture, tone and the small details that make your skin yours.", area: "smooth cheek skin" },
  { id: "cheek", label: "Cheek detail", productId: "barrier-cream", headline: "A little care. A softer touch.", detail: "Make space for a simple ritual, morning and evening.", area: "fair cheek skin" },
  { id: "tone", label: "Skin tone", productId: "peptide-serum", headline: "Every tone. Naturally yours.", detail: "A closer look at your skin’s warmth and natural luminosity.", area: "warm-toned cheek skin" },
  { id: "eye", label: "Fine-line detail", productId: "peptide-serum", headline: "Care for the finer details.", detail: "A moment for the delicate texture that makes skin unique.", area: "hair-free temple skin" },
];
export const sampleSkinResults: SkinResult[] = skinDetails.map(item => ({
  id: `design-sample-${item.id}`, productId: item.productId, label: item.label,
  before: { src: `/images/editorial/skin-detail-${item.id}-before.webp`, alt: `Illustrative ${item.area}, before state` },
  after: { src: `/images/editorial/skin-detail-${item.id}-after.webp`, alt: `Illustrative ${item.area}, simulated after state` },
  headline: item.headline, timeframe: item.detail,
  methodology: "Illustrative comparison. Not measured product results.",
  source: { label: "", url: "" },
  metrics: [
    { value: "Texture", description: "A smooth, soft-looking surface" },
    { value: "Tone", description: "An even-looking complexion" },
    { value: "Radiance", description: "A fresh, luminous appearance" },
    { value: "Hydration", description: "A supple, dewy-looking finish" },
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
