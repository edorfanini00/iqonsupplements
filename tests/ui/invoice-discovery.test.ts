// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi} from 'vitest';
import {render} from '@testing-library/react';
import {CollectionGuide} from '../../app/collection-guide';
vi.mock('../../app/store-shell',async()=>{const {products}=await import('../../lib/catalog');return {useStore:()=>({products,mode:'preview'})};});
it('preview routine guide counts the current invoice eight and links the current cleanser',()=>{
 const {container}=render(React.createElement(CollectionGuide,{department:'skincare'}));
 expect(container.textContent).toContain('8 focused formulas');
 expect(container.querySelector('a[href="/products/enzyme-gel-cleanser"]')).toBeTruthy();
 expect(container.querySelector('a[href="/products/anti-aging-cleanser-with-peptides"]')).toBeNull();
});
