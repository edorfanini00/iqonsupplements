// Layout samples only. Never add these to customerReviews or approvedSkincareResults.
// The server enables them only in development or a Vercel preview deployment.
import type { SkinResult } from "./skincare-results";

const portrait="/images/editorial/skincare-touch-v7.webp";
export const sampleSkinResults: SkinResult[]=["Skin texture","Skin tone","Radiance","Skin feel"].map((label,index)=>({
 id:`design-sample-${index}`,productId:"barrier-cream",label:`${label} layout sample`,
 before:{src:portrait,alt:"Design sample: unchanged IQON editorial portrait"},
 after:{src:portrait,alt:"Design sample: the same unchanged portrait, not a treatment result"},
 headline:"The results. Up close.",timeframe:"Study timeframe and baseline to be supplied.",
 methodology:"Design preview only. The same editorial photograph appears on both sides. IQON study results and before-and-after photographs have not been supplied.",
 source:{label:"",url:""},
 metrics:["Skin texture","Skin tone","Radiance","Skin feel"].map(description=>({value:"—",description})),
 approvedForPublication:false,photographyConsentConfirmed:false,
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
