// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {products,type Product,type StoreCatalog} from '../../lib/catalog';
import {collectionFocus,matchesCollectionFocus} from '../../lib/collection-focus';
import {CollectionPage} from '../../app/collection-page';
const state=vi.hoisted(()=>({products:[] as Product[],mode:'live' as StoreCatalog['mode'],push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:state.push})}));
vi.mock('../../app/store-shell',()=>({useStore:()=>state,ProductCard:({product}:{product:Product})=>React.createElement('article',{'data-testid':'product'},product.name)}));
afterEach(()=>{cleanup();state.push.mockClear();});
function setup(props:Partial<React.ComponentProps<typeof CollectionPage>>={},mode:StoreCatalog['mode']='live'){
 state.products=products.map(p=>({...p,available:true,variants:[{id:p.id,title:'Default Title',price:p.price,currency:'USD',available:true}]}));state.mode=mode;
 return render(React.createElement(CollectionPage,{category:'supplements',...props}));
}
const shown=()=>screen.queryAllByTestId('product').map(x=>x.textContent);
it.each([
 ['training',['creatine-monohydrate']],
 ['everyday-nutrition',['hydrolyzed-collagen-peptides','collagen-peptides-chocolate','hair-skin-nails-gummies']],
 ['digestive-support',['gut-health']],
] as const)('%s has explicit conservative membership, independent of stock',(focus,ids)=>{
 const actual=products.filter(p=>matchesCollectionFocus(p,focus)).map(p=>p.id);
 expect(actual).toEqual([...ids]);
 for(const id of ids){const p=products.find(p=>p.id===id)!;expect(matchesCollectionFocus({...p,available:false,pricePending:true},focus)).toBe(true);expect(matchesCollectionFocus({...p,category:'skincare'},focus)).toBe(false);}
 const known=products.find(p=>p.id===ids[0])!;
 expect(matchesCollectionFocus({...known,id:'synthetic-matching-marketing-words'},focus)).toBe(false);
});
it('All retains every supplement and unmatched products; invalid focus falls back to All',()=>{
 setup({initialFocus:'longevity'});expect(shown()).toHaveLength(11);expect(shown()).toContain('NMN');expect(shown()).toContain('GLP-1 Support');
 expect(collectionFocus('training&fake=1')).toBe('all');
 expect(within(screen.getByRole('navigation',{name:'Browse by focus'})).getByRole('link',{name:'All'}).getAttribute('aria-current')).toBe('true');
});
it('combines focus, format and local search, with a reset that retains sort',()=>{
 const view=setup({initialFocus:'everyday-nutrition',initialFormat:'powder',initialSort:'name'});
 expect(shown()).toEqual(['Grass-Fed Collagen Peptides','Hydrolyzed Collagen Peptides']);
 const search=screen.getByRole('searchbox');fireEvent.change(search,{target:{value:'unflavored'}});expect(shown()).toEqual(['Hydrolyzed Collagen Peptides']);
 fireEvent.change(search,{target:{value:'no-such-product'}});expect(shown()).toEqual([]);expect(screen.getByText('No products found.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Reset filters'}));expect((search as HTMLInputElement).value).toBe('');expect(state.push).toHaveBeenLastCalledWith('/collections/supplements?sort=name',{scroll:false});
 view.rerender(React.createElement(CollectionPage,{category:'supplements',initialSort:'name'}));expect(shown()).toHaveLength(11);
});
it('focus and format links preserve each other and sort, and selected state follows navigation props',()=>{
 const view=setup({initialFocus:'training',initialFormat:'powder',initialSort:'high'});
 const nav=screen.getByRole('navigation',{name:'Browse by focus'});
 expect(within(nav).getByRole('link',{name:'Everyday nutrition'}).getAttribute('href')).toBe('/collections/supplements?format=powder&focus=everyday-nutrition&sort=high');
 expect(within(nav).getByRole('link',{name:'All'}).getAttribute('href')).toBe('/collections/supplements?format=powder&sort=high');
 expect(within(screen.getByRole('navigation',{name:'Shop by format'})).getByRole('link',{name:'Capsules'}).getAttribute('href')).toBe('/collections/supplements?format=capsules&focus=training&sort=high');
 view.rerender(React.createElement(CollectionPage,{category:'supplements',initialFocus:'digestive-support'}));
 expect(shown()).toEqual(['Gut Health']);expect(within(nav).getByRole('link',{name:'Digestive support'}).getAttribute('aria-current')).toBe('true');
});
it.each(['all','skincare'] as const)('does not apply supplement focus to %s',category=>{
 setup({category,initialFocus:'training'});expect(screen.queryByRole('navigation',{name:'Browse by focus'})).toBeNull();expect(shown()).toHaveLength(category==='all'?18:7);
 fireEvent.change(screen.getByRole('searchbox'),{target:{value:'no-match'}});expect(screen.getByText('Try another product name or clear your search.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Show all products'}));expect(shown()).toHaveLength(category==='all'?18:7);expect(state.push).not.toHaveBeenCalled();
});
it('keeps a filter intersection distinct from an empty or unavailable catalog',()=>{
 const view=setup({initialFocus:'training',initialFormat:'capsules'});expect(shown()).toHaveLength(0);expect(screen.getByText('No products found.')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Show all products'}));expect(state.push).toHaveBeenLastCalledWith('/collections/supplements',{scroll:false});
 state.products=[];state.mode='unavailable';view.rerender(React.createElement(CollectionPage,{category:'supplements',initialFocus:'training'}));
 expect(screen.getByText('We’ll be back shortly.')).toBeTruthy();expect(screen.queryByRole('button',{name:'Show all products'})).toBeNull();
 state.mode='live';view.rerender(React.createElement(CollectionPage,{category:'supplements'}));expect(screen.getByText('More to come.')).toBeTruthy();
});
