// Publish only permissioned, genuine reviews from this supplements/skincare store.
// No peptide reviews, generated testimonials, or illustrative ratings belong here.
export type CustomerReview = {
  id:string; productId:string; author:string; rating:1|2|3|4|5;
  title:string; text:string; date:string; verifiedPurchase:boolean;
  media?: {type:"image"|"video";src:string;alt:string;poster?:string};
};
export const customerReviews: CustomerReview[] = [];
