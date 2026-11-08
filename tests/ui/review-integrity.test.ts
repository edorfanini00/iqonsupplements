import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {expect,it,vi} from "vitest";
const data=vi.hoisted(()=>({reviews:[] as unknown[]}));
vi.mock("../../lib/reviews",()=>({get customerReviews(){return data.reviews;}}));
import {CustomerReviews,ProductReviewLink} from "../../app/customer-reviews";
it("design preview does not manufacture stars or endorsements",()=>{
 data.reviews=[];
 expect(renderToStaticMarkup(React.createElement(ProductReviewLink,{productId:"creatine-monohydrate",designPreview:true}))).toBe("");
 const html=renderToStaticMarkup(React.createElement(CustomerReviews,{productId:"creatine-monohydrate",designPreview:true}));
 expect(html).toContain("There are no customer reviews");expect(html).not.toMatch(/review-stars|Sample rating|Verified purchase/);
});
it("genuine low ratings remain visible and count in the average",()=>{
 data.reviews=[{id:"negative",productId:"creatine-monohydrate",rating:1,title:"Not for me",text:"Did not suit my preferences.",author:"Test customer",date:"2026-01-01",verifiedPurchase:false},{id:"positive",productId:"creatine-monohydrate",rating:5,title:"Good",text:"Suited my preferences.",author:"Test customer two",date:"2026-01-02",verifiedPurchase:true}];
 const html=renderToStaticMarkup(React.createElement(CustomerReviews,{productId:"creatine-monohydrate"}));
 expect(html).toContain("Not for me");expect(html).toContain("3.0 / 5");expect(html).toContain("From 2 customer reviews");
});
