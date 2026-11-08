// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {productContent} from '../../lib/product-content';
import {products} from '../../lib/catalog';
import {verifiedLabels} from '../../lib/verified-labels';
import {supplementDetails} from '../../lib/supplement-details';
import {supplementVisualContent} from '../../lib/supplement-visual-content';
import {productPresentation} from '../../lib/product-presentation';
import {productVisuals} from '../../lib/product-visuals';
import {SupplementFormula} from '../../app/supplement-information';
import {ProductStory} from '../../app/product-story';
afterEach(cleanup);

it.each(Object.keys(verifiedLabels))('%s preserves every recovered amount, note and daily value in an accessible table',id=>{
 render(React.createElement(SupplementFormula,{details:supplementDetails[id],productId:id}));
 const table=screen.getByRole('table',{name:'Label amounts per serving'});
 expect(within(table).getAllByRole('columnheader').map(x=>x.textContent)).toEqual(['Nutrient','Amount','Daily Value']);
 const rows=within(table).getAllByRole('row').slice(1);
 expect(rows).toHaveLength(verifiedLabels[id].nutrition!.length);
 verifiedLabels[id].nutrition!.forEach((record,i)=>{
  expect(within(rows[i]).getByRole('rowheader').textContent).toBe(record.name+(record.note||''));
  expect(within(rows[i]).getAllByRole('cell').map(x=>x.textContent)).toEqual([record.amount,record.dailyValue||'Not listed']);
 });
});
it('keeps the two-column fallback and safely omits a table when amounts are unavailable',()=>{
 const details=supplementDetails['glp-1-support'];
 const {rerender}=render(React.createElement(SupplementFormula,{details}));
 expect(within(screen.getByRole('table')).getAllByRole('columnheader').map(x=>x.textContent)).toEqual(['Ingredient','Amount']);
 for(const row of details.amounts!)expect(screen.getByText(row.amount)).toBeTruthy();
 rerender(React.createElement(SupplementFormula,{details:{...details,amounts:undefined},productId:'unknown'}));
 expect(screen.queryByRole('table')).toBeNull();
 expect(screen.getByText(details.ingredients)).toBeTruthy();
});
it('shows the separately printed probiotic mass and CFU count in both sides of the live ingredient explorer',()=>{
 const product=products.find(x=>x.id==='glp-1-support')!;
 render(React.createElement(ProductStory,{product,products}));
 const button=screen.getByRole('button',{name:/Explore LactoSpore/});
 fireEvent.click(button);
 for(const region of [button,screen.getByRole('region',{name:'Ingredient spotlight'})]){
  expect(region.textContent).toContain('166 mg');expect(region.textContent).toContain('6 billion CFU');
  expect(region.textContent).not.toMatch(/does not provide a CFU|not a viable count/);
 }
 expect(button.textContent).toContain('does not specify whether the count applies at manufacture or through expiry');
});
it('keeps legacy GLP-1 and Liver Support copy consistent with recovered facts, retaining genuine unknowns',()=>{
 const glp=[supplementVisualContent['glp-1-support'].ingredients[1].summary,productPresentation['glp-1-support'].focus.rows[1].detail,productVisuals['glp-1-support'].mechanism[2].body];
 for(const text of glp){expect(text).toContain('166 mg');expect(text).toContain('separately states 6 billion CFU');expect(text).toContain('does not specify');}
 expect(productPresentation['liver-support'].note).not.toContain('No ingredient doses');
 expect(productPresentation['liver-support'].focus.rows[1].detail).toContain('50 mg');
 expect(productVisuals['liver-support'].mechanism[1].body).toContain('50 mg');
 expect(supplementVisualContent['keto-5'].routineNote).toContain('total amount is not disclosed');
 expect(productPresentation['keto-5'].note).toContain('Individual amounts are not disclosed');
 expect(productPresentation['gut-health'].note).toContain('at the time of manufacture');
});

it('Gummies active and legacy ingredient copy acknowledges its recovered nutrient amounts',()=>{
 expect(productContent['hair-skin-nails-gummies'].ingredients![1].detail).toContain('label lists individual nutrient amounts');
 expect(productPresentation['hair-skin-nails-gummies'].focus.rows[1].detail).toContain('label lists individual nutrient amounts');
});
