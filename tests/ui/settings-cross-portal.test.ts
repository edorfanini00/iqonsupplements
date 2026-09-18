// @vitest-environment jsdom
/** Local simulated authority/identity/provider boundary. Never calls a live provider. */
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import BodySettings from '../../app/affiliates/admin/settings/page';
import HealthSettings from '../../../iqon-health-rate-settings/app/affiliates/admin/settings/page';
import {validateCommand,commandHash} from '../../../iqon-health-rate-settings/lib/integrations/body/commands/validation';
import {canonicalActionFetch as bodySave} from '../../lib/affiliates/canonical-action-fetch';
import {canonicalActionFetch as healthSave} from '../../../iqon-health-rate-settings/lib/integrations/body/commands/settings-action-fetch';
import {browserCommandClient as bodyClient} from '../../lib/affiliates/canonical-command-client';
import {browserCommandClient as healthClient} from '../../../iqon-health-rate-settings/lib/integrations/body/commands/settings-command-client';
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
function fixture(){
 const historical=Object.freeze([{id:'historical-order',commission:15}]);
 const healthProfile=Object.freeze({commissionRate:15,recurringCommissionRate:11,couponRate:15});
 const states:any={a:{affiliateId:'a',version:0,terms:[],outbox:[]},b:{affiliateId:'b',version:0,terms:[],outbox:[]}};
 const receipts=new Map<string,any>();const posts:any[]=[];let role='admin';let lose=false;
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/me'))return Response.json({user:{id:'fixture-admin',role,status:'active'}});
  if(url.endsWith('shared-session'))return Response.json({version:1,session:{wpUserId:99001,email:'fixture@local.invalid',role,wpRoles:role==='admin'?['administrator']:[],profile:null}});
  if(role!=='admin')return Response.json({error:'Forbidden'},{status:403});
  if(url.endsWith('/admin/affiliates'))return Response.json({affiliates:[{id:'a',firstName:'Ada',lastName:'Test',...healthProfile},{id:'b',firstName:'Bea',lastName:'Test'}]});
  if(url.includes('/state/'))return Response.json(states[url.split('/').pop()!]);
  if(init?.method==='POST'){
   const raw=JSON.parse(String(init.body));posts.push({url,raw,bytes:init.body});
   const command=validateCommand('commission-settings',raw);const hash=commandHash(command,'wp:99001');
   const prior=receipts.get(command.commandId);
   if(prior)return prior.hash===hash?Response.json(prior.result):Response.json({errorDetail:{code:'CONFLICT'}},{status:409});
   const state=states[command.payload.affiliateId];
   if(command.expectedVersion!==state.version)return Response.json({errorDetail:{code:'VERSION_CONFLICT'}},{status:409});
   state.version++;
   for(const terms of command.payload.rates)state.terms.push({category:terms.category,store:terms.store,version:state.version,terms});
   state.outbox=[{store:'woo',operation:'public-code',state:'confirmed'},{store:'shopify',operation:'public-code',state:'blocked',reason:'Provider activation disabled in local fixture'}];
   const result={command:{id:command.commandId,kind:'commission-settings',state:'committed',version:state.version},outbox:state.outbox};
   receipts.set(command.commandId,{hash,result});
   if(lose){lose=false;throw Error('simulated response lost after commit');}
   return Response.json(result);
  }
  const receipt=receipts.get(url.split('/').pop()!);return receipt?Response.json(receipt.result):Response.json({error:'Not found'},{status:404});
 }));
 return {states,posts,historical,healthProfile,setRole:(value:string)=>role=value,loseNext:()=>lose=true};
}
async function selectAffiliate(Page:React.ComponentType,id='a'){
 render(React.createElement(Page));fireEvent.change(await screen.findByLabelText('Affiliate scope'),{target:{value:id}});await screen.findByText(/Current canonical version:/);
}
function fillTerms(category='supplements',direct='23'){
 fireEvent.change(screen.getByLabelText('Category'),{target:{value:category}});
 for(const [label,value] of [['Direct commission (%)',direct],['Recurring commission (%)','4'],['Referral commission (%)','0'],['Customer discount (%)','7'],['Referral base','commission'],['Effective at (your local time)','2027-01-01T12:00'],['Eligible product IDs (explicit, comma separated)','gid://shopify/Product/1'],['Customer eligibility','all'],['Combine with order discounts','yes'],['Combine with product discounts','no'],['Combine with shipping discounts','yes']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByLabelText('Subscriptions'));
 fireEvent.change(screen.getByLabelText('Recurring cycle limit (0 means unlimited)'),{target:{value:'0'}});
}
it('saves Body Settings, reloads Health, saves distinct skincare there and reads both back on Body',async()=>{
 const f=fixture();await selectAffiliate(BodySettings);fillTerms();
 fireEvent.click(screen.getByRole('button',{name:'Save explicit category terms'}));
 await screen.findByText(/Direct 23%/);
 expect(f.posts[0].raw.payload.rates[0]).toMatchObject({directRate:23,referralRate:0,purchaseTypes:['subscription'],recurringCycleLimit:0,combinesWith:{orderDiscounts:true,productDiscounts:false,shippingDiscounts:true}});
 cleanup();await selectAffiliate(HealthSettings);
 expect(await screen.findByText(/Direct 23%/)).toBeTruthy();
 fillTerms('skincare','31');fireEvent.click(screen.getByRole('button',{name:'Save explicit category terms'}));
 await screen.findByText(/Direct 31%/);
 expect(f.posts[1].url).toBe('/api/integrations/body/commands/commission-settings');
 expect(f.posts[1].raw.expectedVersion).toBe(1);
 cleanup();await selectAffiliate(BodySettings);
 expect(await screen.findByText(/Direct 23%/)).toBeTruthy();expect(screen.getByText(/Direct 31%/)).toBeTruthy();
 expect(f.states.b.terms).toEqual([]);expect(f.healthProfile).toEqual({commissionRate:15,recurringCommissionRate:11,couponRate:15});expect(f.historical).toEqual([{id:'historical-order',commission:15}]);
 expect(f.posts).toHaveLength(2);
});
it('retains identical bytes after response loss, detects stale cross-portal versions, and never mistakes pending for confirmed',async()=>{
 const f=fixture();const rate={store:'shopify',category:'supplements',directRate:0,recurringRate:0,referralRate:0,customerDiscount:0,referralBase:'revenue',effectiveAt:'2027-01-01T00:00:00.000Z',eligibleProductIds:['gid://shopify/Product/1'],purchaseTypes:['one_time'],customerEligibility:'all',combinesWith:{orderDiscounts:false,productDiscounts:true,shippingDiscounts:false}};
 const init={method:'PUT',body:JSON.stringify({affiliateId:'a',rates:[rate]})};
 f.loseNext();expect((await bodySave('/api/affiliates/admin/rates',init,0)).ok).toBe(false);
 expect((await bodySave('/api/affiliates/admin/rates',init,1)).ok).toBe(false);
 expect(f.posts[1].bytes).toBe(f.posts[0].bytes);expect(f.states.a.version).toBe(1);
 expect((await healthSave('/api/affiliates/admin/rates',init,0)).ok).toBe(false);
 expect(f.states.a.version).toBe(1);
 const bodyAttempt=bodyClient().list('wp:99001')[0];expect((await bodyClient().check('wp:99001',bodyAttempt)).ok).toBe(false);
 expect(healthClient().list('health-settings:fixture-admin').every(a=>a.archived)).toBe(true);
 f.setRole('affiliate');expect((await bodySave('/api/affiliates/admin/rates',init,1)).ok).toBe(false);expect((await healthSave('/api/affiliates/admin/rates',init,1)).ok).toBe(false);
 expect(f.posts).toHaveLength(3);
});
