import { ArrowUpRight, Star } from "lucide-react";
import { customerReviews } from "@/lib/reviews";
import { products, type Category } from "@/lib/catalog";

function RatingStars({rating}:{rating?:number}) {
 const value=Math.max(0,Math.min(5,rating??0));
 return <span className="review-stars" role="img" aria-label={rating===undefined?"No customer ratings yet":`${value.toFixed(1)} out of 5 stars`}>
  {[1,2,3,4,5].map(n=><span className="review-star" key={n} aria-hidden="true"><Star size={16}/><span style={{width:`${Math.max(0,Math.min(1,value-n+1))*100}%`}}><Star size={16} fill="currentColor"/></span></span>)}
 </span>;
}

export function ProductReviewLink({productId}:{productId:string}) {
 const reviews=customerReviews.filter(review=>review.productId===productId);
 const average=reviews.length?reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length:undefined;
 return <a href="#reviews" className="product-review-link"><RatingStars rating={average}/><span>Customer reviews{reviews.length>0&&` (${reviews.length})`}</span><ArrowUpRight size={13} aria-hidden="true"/></a>;
}

export function CustomerReviews({productId,productName,category}:{productId?:string;productName?:string;category?:Category}) {
 const reviews=customerReviews.filter(r=>(!productId||r.productId===productId)&&(!category||products.some(p=>p.id===r.productId&&p.category===category)));
 const average=reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:0;
 return <section className="customer-reviews section-pad" id="reviews" aria-labelledby="reviews-heading"><div className="section-heading"><div><p className="eyebrow">THE IQON COMMUNITY</p><h2 id="reviews-heading">Customer reviews.</h2></div><div className="review-summary"><RatingStars rating={reviews.length?average:undefined}/><span className="review-count">{reviews.length} {reviews.length===1?"review":"reviews"}</span></div></div>{reviews.length?<><p className="review-average">{average.toFixed(1)} / 5 <span>From {reviews.length} customer reviews</span></p><div className="review-grid">{reviews.map(review=><article key={review.id}><RatingStars rating={review.rating}/><h3>{review.title}</h3><p>{review.text}</p><footer><span>{review.author}{review.verifiedPurchase&&<small>Verified purchase</small>}</span><time dateTime={review.date}>{new Date(review.date).toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"})}</time></footer></article>)}</div></>:<div className="reviews-awaiting"><span className="review-outline" aria-hidden="true"><Star size={30} strokeWidth={1}/></span><div><h3>{productName?`Be the first to share your experience with ${productName}.`:"Every experience starts somewhere."}</h3><p>There are no customer reviews yet. Reviews will appear here after the collection launches.</p></div></div>}</section>;
}
