import {it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CanonicalAffiliateControls,buildCategoryTerms} from '../../components/affiliates/shared/CanonicalAffiliateControls';
it('offers explicit category terms and code controls without inventing rates',()=>{
 const html=renderToStaticMarkup(React.createElement(CanonicalAffiliateControls,{affiliateId:'a'}));
 for(const label of ['Category commission terms','Customer discount','Eligible product IDs','Effective at','Referral base','Verify creator code'])expect(html).toContain(label);
 expect(html).not.toContain('value="15"');
 expect(()=>buildCategoryTerms({category:'supplements',referralBase:'revenue',purchaseOneTime:true,purchaseSubscription:false,eligibility:'all',combineOrder:'no',combineProduct:'no',combineShipping:'no',cycleLimit:'',direct:'',recurring:'0',referral:'0',discount:'0',effective:'2027-01-01T00:00',products:'gid://shopify/Product/1'})).toThrow();
 const r=buildCategoryTerms({category:'supplements',referralBase:'revenue',purchaseOneTime:true,purchaseSubscription:false,eligibility:'all',combineOrder:'no',combineProduct:'no',combineShipping:'no',cycleLimit:'',direct:'0',recurring:'0',referral:'0',discount:'0',effective:'2027-01-01T00:00',products:'gid://shopify/Product/1'});
 expect(r.purchaseTypes).toEqual(['one_time']);expect(r.combinesWith).toEqual({orderDiscounts:false,productDiscounts:false,shippingDiscounts:false});expect(r.referralBase).toBe('revenue');expect(r.directRate).toBe(0);expect(r.store).toBe('shopify');expect(r.eligibleProductIds).toEqual(['gid://shopify/Product/1']);
});
