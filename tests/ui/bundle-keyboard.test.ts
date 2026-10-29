// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ProductBundleOptions} from '../../app/product-bundle-options';

afterEach(cleanup);
function setup(initial=1) {
 const changed=vi.fn();
 function Fixture() {
  const [quantity,setQuantity]=React.useState(initial);
  return React.createElement(ProductBundleOptions,{quantity,price:48.97,currency:'USD',setQuantity:(n:number)=>{changed(n);setQuantity(n);}});
 }
 render(React.createElement(Fixture));
 const radios=screen.getAllByRole('radio') as HTMLButtonElement[];
 React.act(()=>radios[0].focus());
 return {radios,changed};
}
function tap(key:string) {
 const current=document.activeElement!;
 fireEvent.keyDown(current,{key});
 // Release immediately, independent of selection. No timer or state wait.
 fireEvent.keyUp(document.activeElement!,{key});
}
function selected(radios:HTMLButtonElement[],index:number) {
 expect(document.activeElement).toBe(radios[index]);
 expect(radios.map(r=>r.getAttribute('aria-checked'))).toEqual(radios.map((_,i)=>String(i===index)));
 expect(radios.filter(r=>r.tabIndex===0)).toEqual([radios[index]]);
 expect(radios.every(r=>r.tabIndex<=0)).toBe(true);
}
it('selects and focuses each arrow, wrapping, Home/End and PageUp/PageDown synchronously once',()=>{
 const {radios,changed}=setup();
 for(const [key,index] of [['ArrowDown',1],['ArrowRight',2],['ArrowDown',0],['ArrowUp',2],['ArrowLeft',1],['Home',0],['End',2],['PageUp',0],['PageDown',2]] as const) {
  changed.mockClear();tap(key);selected(radios,index);expect(changed.mock.calls).toEqual([[index+1]]);
 }
});
it('held/repeated arrows do not trigger duplicate selection on focus',()=>{
 const {radios,changed}=setup();
 for(const index of [1,2,0]) {
  changed.mockClear();fireEvent.keyDown(document.activeElement!,{key:'ArrowDown',repeat:true});
  selected(radios,index);expect(changed.mock.calls).toEqual([[index+1]]);
 }
 fireEvent.keyUp(document.activeElement!,{key:'ArrowDown'});
});
it('skips disabled radios and handles RTL horizontal navigation',()=>{
 const {radios,changed}=setup();radios[1].disabled=true;
 tap('ArrowDown');selected(radios,2);expect(changed.mock.calls).toEqual([[3]]);
 tap('Home');selected(radios,0);
 screen.getByRole('radiogroup').style.direction='rtl';
 tap('ArrowRight');selected(radios,2);
 tap('ArrowLeft');selected(radios,0);
});
it('leaves modified shortcuts and Tab alone, and pointer selection still changes once',()=>{
 const {radios,changed}=setup();
 for(const modifier of ['altKey','ctrlKey','metaKey','shiftKey']) {
  expect(fireEvent.keyDown(radios[0],{key:'ArrowDown',[modifier]:true})).toBe(true);
  fireEvent.keyUp(radios[0],{key:'ArrowDown'});
 }
 expect(fireEvent.keyDown(radios[0],{key:'Tab'})).toBe(true);
 expect(changed).not.toHaveBeenCalled();
 fireEvent.click(radios[1]);expect(changed.mock.calls).toEqual([[2]]);
 expect(radios[1].getAttribute('aria-checked')).toBe('true');
});
it('keeps a quantity above three when navigation lands on its already selected 3+ tier',()=>{
 const {radios,changed}=setup(4);
 React.act(()=>radios[2].focus());tap('End');selected(radios,2);
 expect(changed).not.toHaveBeenCalled();
 tap('Home');expect(changed.mock.calls).toEqual([[1]]);
});
