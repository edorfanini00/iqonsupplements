// Illustrative summaries for the labeled development/Vercel design preview only.
// These are not customer reviews and must never be used as published review evidence.
import type { SampleReviewCard } from "./skincare-design-preview";

export type PreviewReviewSummary = { rating:number; count:number };

export const previewReviewSummaries: Record<string, PreviewReviewSummary> = {
  "creatine-monohydrate": { rating:4.9, count:400 },
  "hydrolyzed-collagen-peptides": { rating:4.8, count:350 },
  "collagen-peptides-chocolate": { rating:4.7, count:250 },
  "colostrum-powder": { rating:4.9, count:200 },
  "colon-gentle-cleanse": { rating:4.6, count:150 },
  "keto-5": { rating:4.6, count:175 },
  "glp-1-support": { rating:4.8, count:300 },
  "liver-support": { rating:4.7, count:225 },
  "nmn": { rating:4.9, count:500 },
  "resveratrol": { rating:4.8, count:275 },
  "hair-skin-nails-gummies": { rating:4.8, count:450 },
  "peptide-serum": { rating:4.9, count:650 },
  "barrier-cream": { rating:4.8, count:550 },
  "gentle-cleanser": { rating:4.7, count:325 },
};

export const supplementReviewCards:SampleReviewCard[] = [
  {id:"creatine",image:"/images/supplements/12_hero_creatine_scoop.webp",alt:"IQON Creatine Monohydrate with an open jar and a measured scoop"},
  {id:"intention",title:"A little intention. Every day."},
  {id:"rhythm",title:"Your routine. Your rhythm."},
  {id:"capsules",image:"/images/supplements/11_hero_liver_capsules.webp",alt:"IQON Liver Support with a close look at its capsule format"},
  {id:"gummies",image:"/images/supplements/14_hero_gummies_falling.webp",alt:"IQON Hair, Skin & Nails Gummies in their clear branded jar"},
  {id:"habits",title:"Good habits start small."},
  {id:"everyday",title:"Make room for the everyday."},
  {id:"colostrum",image:"/images/supplements/16_hero_colostrum_open.webp",alt:"An open IQON Colostrum Powder jar with its scoop"},
];
