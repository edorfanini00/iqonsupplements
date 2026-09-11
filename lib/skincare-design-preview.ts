// Illustrative skin comparisons and review layout samples, never verified product results.
// Skincare explicitly displays the captioned comparisons; review samples remain preview-only.
import type { SkinResult } from "./skincare-results";

const skinDetails = [
  { id: "texture", label: "Skin texture", productId: "copper-peptide-restore-cream", headline: "Your skin. In its best light.", detail: "Texture, tone and the small details that make your skin yours.", area: "close-up cheek skin" },
  { id: "cheek", label: "Cheek detail", productId: "copper-peptide-restore-cream", headline: "A little care. A softer touch.", detail: "Make space for a simple ritual, morning and evening.", area: "skin texture beside the nose" },
  { id: "tone", label: "Skin tone", productId: "hydra-c-ferulic-serum", headline: "Every tone. Naturally yours.", detail: "A closer look at your skin’s warmth and natural luminosity.", area: "cheek skin with natural pigmentation" },
  { id: "eye", label: "Fine-line detail", productId: "hydra-c-ferulic-serum", headline: "Care for the finer details.", detail: "A moment for the delicate texture that makes skin unique.", area: "fine cheek texture" },
];
export const sampleSkinResults: SkinResult[] = skinDetails.map(item => ({
  id: `design-sample-${item.id}`, productId: item.productId, label: item.label,
  before: { src: `/images/editorial/skin-detail-${item.id}-before-v11.webp`, alt: `Illustrative ${item.area}, before state` },
  after: { src: `/images/editorial/skin-detail-${item.id}-after-v11.webp`, alt: `Illustrative ${item.area}, simulated after state with natural pores and skin detail retained` },
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
 {id:"serum",image:"/images/editorial/community-serum-fingertip.webp",alt:"A clear serum droplet resting on a fingertip in soft daylight"},
 {id:"ritual",title:"A few essentials. A moment for you."},
 {id:"daily",title:"A little care. Every day."},
 {id:"touch",image:"/images/skincare/editorial/community-serum-iqon-v11.webp",alt:"Hands holding the IQON Hydra C + Ferulic Serum bottle with its silver cap and base"},
 {id:"collection",image:"/images/editorial/community-cream-glass.webp",alt:"A soft white cream texture on clear glass"},
 {id:"rhythm",title:"Find your skincare rhythm."},
 {id:"moment",title:"Make a little time for you."},
 {id:"essentials",image:"/images/skincare/editorial/community-cream-iqon-v11.webp",alt:"IQON Copper Peptide Restore Cream beside a cream texture on a cool blue-gray surface"},
];
