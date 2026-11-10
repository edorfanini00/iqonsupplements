// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,render} from '@testing-library/react';
import {newSkincareProducts,newSkincareImage} from '../../lib/new-skincare';
import {products} from '../../lib/catalog';
import {SkincareProductStory} from '../../app/skincare-product-story';
import {ProductGallery} from '../../app/product-gallery';

afterEach(cleanup);
describe('new-only media integration',()=>{
 for(const product of newSkincareProducts){
  it(`${product.id} renders its accepted packshot, visible honest texture caption and all comparison sizes`,()=>{
   const {container}=render(React.createElement(React.Fragment,null,
    React.createElement(ProductGallery,{product}),
    React.createElement(SkincareProductStory,{product,comparison:newSkincareProducts})));
   expect(container.querySelector('.visual-pack img')?.getAttribute('src')).toBe(product.image);
   expect(container.querySelector('.product-preview-note')?.textContent).toBe('AI-generated packaging visualization based on approved artwork and supplier container references; not a supplier photograph.');
   expect(container.querySelector('.visual-pack img')?.getAttribute('alt')).toContain('AI-generated packaging visualization');
   expect(container.querySelector('.skin-benefits-photo img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'texture'));
   const caption=container.querySelector('.skin-benefits-photo figcaption')!;
   expect(caption.textContent).toBe('Illustrative texture study, not the finished formula');
   expect(caption.classList.contains('sr-only')).toBe(false);
   expect(container.querySelector('.skin-photo-label')?.textContent).toBe('TEXTURE STUDY');
   expect(Array.from(container.querySelectorAll('.skin-compare-product p span')).map(el=>el.textContent)).toEqual(newSkincareProducts.map(p=>p.size));
   expect(container.querySelector('.skin-application-photo img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'editorial'));
   expect(container.querySelector('.visual-editorial img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'editorial'));
   for(const selector of ['.visual-editorial img','.skin-application-photo img']){
    const image=container.querySelector(selector)!;
    expect(image.getAttribute('src')).toBe(`/images/skincare/new-products-only/${product.id}/editorial.webp`);
    expect(image.getAttribute('alt')).toBe({
     'enzyme-gel-cleanser':'IQON Enzyme Gel Cleanser white bottle on a grey counter with a folded white towel and cropped metal tray — AI-generated packaging visualization',
     'hyaluronic-serum':'IQON Hyaluronic Serum silver bottle on a reflective metal pedestal beside an empty shallow glass dish — AI-generated packaging visualization',
     'peptide-anti-wrinkle-day-cream':'IQON Peptide Anti-Wrinkle Day Cream silver bottle on a grey counter with folded white towels and a cropped metal tray — AI-generated packaging visualization',
    }[product.id]);
   }
   expect(container.innerHTML).not.toMatch(/image pending|editorial\.svg/i);
  });
 }
 it('keeps supplement galleries unchanged and distinguishes skincare image provenance',()=>{
  for(const product of products){
   const {container}=render(React.createElement(ProductGallery,{product}));
   if(product.category==='supplements')expect(container.querySelector('.product-preview-note')).toBeNull();
   else expect(container.querySelector('.product-preview-note')?.textContent).toMatch(/not a supplier photograph|not verification/);
   cleanup();
  }
 });
});
