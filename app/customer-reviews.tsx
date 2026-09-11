import { ArrowUpRight, Star } from "lucide-react";
import { customerReviews, type CustomerReview } from "@/lib/reviews";
import { products, type Category } from "@/lib/catalog";
import { previewReviewSummaries } from "@/lib/review-design-preview";

function RatingStars({rating,sample=false}:{rating?:number;sample?:boolean}) {
 const value=Math.max(0,Math.min(5,rating??0));
 return <span className="review-stars" role="img" aria-label={rating===undefined?"No customer ratings yet":`${sample?"Sample rating: ":""}${value.toFixed(1)} out of 5 stars`}>
  {[1,2,3,4,5].map(n=><span className="review-star" key={n} aria-hidden="true"><Star size={16}/><span style={{width:`${Math.max(0,Math.min(1,value-n+1))*100}%`}}><Star size={16} fill="currentColor"/></span></span>)}
 </span>;
}

function reviewSummary(reviews:CustomerReview[],productId?:string,designPreview=false) {
 const sample=designPreview&&reviews.length===0&&productId?previewReviewSummaries[productId]:undefined;
 const average=reviews.length?reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length:sample?.rating;
 const count=reviews.length||sample?.count||0;
 return {average,isSample:!!sample,countLabel:`${count}${sample?"+":""} ${count===1?"review":"reviews"}`};
}

export function ProductReviewLink({productId,designPreview=false}:{productId:string;designPreview?:boolean}) {
 const reviews=customerReviews.filter(review=>review.productId===productId);
 const {average,isSample,countLabel}=reviewSummary(reviews,productId,designPreview);
 return <a href="#reviews" className="product-review-link">
  <RatingStars rating={average} sample={isSample}/>
  <span>{average===undefined?"Customer reviews":`${average.toFixed(1)} / 5 · ${countLabel}`}</span>
  <ArrowUpRight size={13} aria-hidden="true"/>
 </a>;
}

export function CustomerReviews({productId,productName,category,designPreview=false}:{productId?:string;productName?:string;category?:Category;designPreview?:boolean}) {
 const reviews=customerReviews.filter(r=>(!productId||r.productId===productId)&&(!category||products.some(p=>p.id===r.productId&&p.category===category)));
 const {average,isSample,countLabel}=reviewSummary(reviews,productId,designPreview);
 return <section className="customer-reviews section-pad" id="reviews" aria-labelledby="reviews-heading">
  <div className="section-heading">
   <div><p className="eyebrow">THE IQON COMMUNITY</p><h2 id="reviews-heading">Customer reviews.</h2></div>
   <div className="review-summary">
    <RatingStars rating={average} sample={isSample}/>
    <span className="review-count">{countLabel}</span>
   </div>
  </div>
  {average!==undefined&&<p className="review-average">{average.toFixed(1)} / 5{!isSample&&<span>From {reviews.length} customer reviews</span>}</p>}
  {reviews.length>0?<div className="review-grid">{reviews.map(review=><article key={review.id}>
   <RatingStars rating={review.rating}/><h3>{review.title}</h3><p>{review.text}</p>
   <footer><span>{review.author}{review.verifiedPurchase&&<small>Verified purchase</small>}</span><time dateTime={review.date}>{new Date(review.date).toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"})}</time></footer>
  </article>)}</div>:isSample?<p className="review-preview-note">Customer reviews will appear here after the collection launches.</p>:<div className="reviews-awaiting">
   <span className="review-outline" aria-hidden="true"><Star size={30} strokeWidth={1}/></span>
   <div><h3>{productName?`Be the first to share your experience with ${productName}.`:"Every experience starts somewhere."}</h3><p>There are no customer reviews yet. Reviews will appear here after the collection launches.</p></div>
  </div>}
 </section>;
}
