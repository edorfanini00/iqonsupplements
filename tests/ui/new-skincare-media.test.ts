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
   expect(container.querySelector('.product-preview-note')?.textContent).toContain('not a supplier photograph');
   expect(container.querySelector('.skin-benefits-photo img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'texture'));
   const caption=container.querySelector('.skin-benefits-photo figcaption')!;
   expect(caption.textContent).toBe('Illustrative texture study, not the finished formula');
   expect(caption.classList.contains('sr-only')).toBe(false);
   expect(container.querySelector('.skin-photo-label')?.textContent).toBe('TEXTURE STUDY');
   expect(Array.from(container.querySelectorAll('.skin-compare-product p span')).map(el=>el.textContent)).toEqual(newSkincareProducts.map(p=>p.size));
   expect(container.querySelector('.skin-application-photo img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'editorial'));
   expect(container.querySelector('.visual-editorial img')?.getAttribute('src')).toBe(newSkincareImage(product.id,'editorial'));
  });
 }
 it('does not introduce the new packaging disclosure on any existing gallery',()=>{
  for(const product of products){
   const {container}=render(React.createElement(ProductGallery,{product}));
   expect(container.querySelector('.product-preview-note')).toBeNull();
   cleanup();
  }
 });
});
