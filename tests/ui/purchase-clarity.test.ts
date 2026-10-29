// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CustomerReviews,ProductReviewLink} from '../../app/customer-reviews';
const data=vi.hoisted(()=>({reviews:[] as unknown[]}));
vi.mock('../../lib/reviews',()=>({customerReviews:data.reviews}));
afterEach(()=>{cleanup();data.reviews.length=0;});
it('does not show empty rating stars or stale launch promises for an orderable product',()=>{
 const {container}=render(React.createElement(React.Fragment,null,React.createElement(ProductReviewLink,{productId:'creatine-monohydrate'}),React.createElement(CustomerReviews,{productId:'creatine-monohydrate',productName:'Creatine Monohydrate'})));
 expect(container.querySelector('.review-stars,.product-review-link')).toBeNull();
 expect(container.textContent).toContain('There are no customer reviews for Creatine Monohydrate yet.');
 expect(container.textContent).not.toMatch(/after the collection launches|0 reviews|Be the first/);
});
it('preserves genuine ratings, review text and verified-purchase attribution',()=>{
 data.reviews.push({id:'real-fixture',productId:'creatine-monohydrate',author:'Test reviewer',rating:4,title:'A clear label',text:'Permissioned review fixture.',date:'2026-10-01',verifiedPurchase:true});
 render(React.createElement(React.Fragment,null,React.createElement(ProductReviewLink,{productId:'creatine-monohydrate'}),React.createElement(CustomerReviews,{productId:'creatine-monohydrate'})));
 expect(screen.getByText('A clear label')).toBeTruthy();expect(screen.getByText('Verified purchase')).toBeTruthy();
 expect(screen.getByRole('link').getAttribute('href')).toBe('#reviews');
 expect(screen.getAllByRole('img',{name:'4.0 out of 5 stars'})).toHaveLength(3);
});
