// @vitest-environment jsdom
import React from 'react';
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup,within} from '@testing-library/react';
import Page from '../../app/affiliates/admin/payouts/page';
const affiliateId='payout-browser-fixture';
const allocations=[{orderId:'partial',amount:6},{orderId:'new',amount:70},{orderId:'refund',amount:-5}];
const bucket={currency:'USD',amount:71,payable:true,allocations};
const session={version:1,session:{wpUserId:99001,email:'admin@local.invalid',role:'admin',wpRoles:['administrator'],profile:null}};
function setup(buckets:any[]=[bucket],read?:()=>Promise<Response>){
 const posts:any[]=[];
 const fetcher=vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.includes('/outstanding?'))return read?read():Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets});
  if(url.endsWith('/shared-session'))return Response.json(session);
  if(url.includes('/commands/payout-record')){const envelope=JSON.parse(String(init?.body));posts.push(envelope);return Response.json({command:{id:envelope.commandId,kind:'payout-record',state:'committed'},payout:{id:'receipt',amount:envelope.payload.amount}});}
  return Response.json({payouts:[],pendingByAffiliate:[{id:affiliateId,name:'Synthetic Fixture',promoCode:'FIXTURE',pendingCommission:85,pendingOrders:7,bankInfoOnFile:true,orders:[]}]});
 });
 vi.stubGlobal('fetch',fetcher);return {posts,fetcher};
}
async function open(){render(React.createElement(Page));fireEvent.click(await screen.findByRole('button',{name:'Record payout'}));return screen.getByText('Amount due').closest('.fixed') as HTMLElement;}
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()});
it('keeps currencies separate, blocks unknown/nonpositive, submits selected currency allocations',async()=>{
 const eur={currency:'EUR',amount:12,payable:true,allocations:[{orderId:'eur',amount:17},{orderId:'eur-refund',amount:-5}]};
 const {posts}=setup([bucket,eur,{currency:null,amount:5,payable:false,allocations:[{orderId:'unknown',amount:5}]},{currency:'GBP',amount:-2,payable:false,allocations:[{orderId:'gbp',amount:-2}]}]);
 const d=await open();await within(d).findByText('USD 71.00',{selector:'p'});
 const select=within(d).getByLabelText('Payout currency');
 for(const value of ['', 'GBP']){fireEvent.change(select,{target:{value}});expect((within(d).getByRole('button',{name:'Mark as paid'}) as HTMLButtonElement).disabled).toBe(true);}
 fireEvent.change(select,{target:{value:'EUR'}});expect(within(d).getByText('EUR 12.00',{selector:'p'})).toBeTruthy();
 fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await waitFor(()=>expect(posts).toHaveLength(1));expect(posts[0].payload.amount).toBe(12);expect(posts[0].payload.allocations).toEqual(eur.allocations);expect(posts[0].payload).not.toHaveProperty('orderIds');
});
it('clears stale values on failed fresh read and blocks submission',async()=>{
 let n=0;const {posts}=setup([bucket],async()=>++n===1?Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[bucket]}):Response.json({error:'down'},{status:503}));
 const d=await open();await within(d).findByText('USD 71.00',{selector:'p'});fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));
 await within(d).findByText('Unavailable');expect(within(d).queryByText('USD 71.00',{selector:'p'})).toBeNull();expect(posts).toHaveLength(0);expect((within(d).getByRole('button',{name:'Mark as paid'}) as HTMLButtonElement).disabled).toBe(true);
});
it('new refund in preflight requires review rather than submitting stale amounts',async()=>{
 let n=0;const fresh={...bucket,amount:69,allocations:[...allocations,{orderId:'late-refund',amount:-2}]};
 const {posts}=setup([bucket],async()=>Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[++n===1?bucket:fresh]}));
 const d=await open();await within(d).findByText('USD 71.00',{selector:'p'});fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));
 await within(d).findByText(/Outstanding changed/);expect(posts).toHaveLength(0);await within(d).findByText('USD 69.00',{selector:'p'});
 fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await waitFor(()=>expect(posts).toHaveLength(1));expect(posts[0].payload.allocations).toEqual(fresh.allocations);
});
it('reopen after lost response retains original details amount allocations and key even after outstanding becomes zero',async()=>{
 const {fetcher}=setup();const original=fetcher.getMockImplementation()!;const posts:any[]=[];let paid=false;
 fetcher.mockImplementation(async(url,init)=>{
  if(url.includes('/outstanding?')&&paid)return Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[]});
  if(url.includes('/commands/payout-record')){const envelope=JSON.parse(String(init?.body));posts.push(envelope);if(!paid){paid=true;throw Error('dropped committed response');}return Response.json({command:{id:envelope.commandId,kind:'payout-record',state:'committed'},payout:{id:'one-payout'}});}
  return original(url,init);
 });
 let d=await open();await within(d).findByText('USD 71.00',{selector:'p'});fireEvent.change(within(d).getByPlaceholderText('Reference (e.g. wire confirmation #)'),{target:{value:'original reference'}});
 fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await within(d).findByText(/Outcome unknown/);fireEvent.click(within(d).getByRole('button',{name:'Cancel'}));fireEvent.click(screen.getByRole('button',{name:'Record payout'}));d=screen.getByRole('dialog');
 await within(d).findByText('USD 71.00',{selector:'p'});
 await waitFor(()=>expect((within(d).getByPlaceholderText('Reference (e.g. wire confirmation #)') as HTMLInputElement).value).toBe('original reference'));
 await waitFor(()=>expect((within(d).getByRole('button',{name:'Mark as paid'}) as HTMLButtonElement).disabled).toBe(false));fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await waitFor(()=>expect(posts).toHaveLength(2));expect(posts[1]).toEqual(posts[0]);
});
it('late response from a closed modal cannot replace reopened fresh outstanding',async()=>{
 let resolveOld!:(r:Response)=>void;let reads=0;
 setup([bucket],async()=>++reads===1?new Promise<Response>(resolve=>{resolveOld=resolve}):Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[{...bucket,amount:9,allocations:[{orderId:'latest',amount:9}]}]}));
 let d=await open();await waitFor(()=>expect(reads).toBe(1));fireEvent.click(within(d).getByRole('button',{name:'Cancel'}));fireEvent.click(screen.getByRole('button',{name:'Record payout'}));d=screen.getByRole('dialog');
 await within(d).findByText('USD 9.00',{selector:'p.text-2xl'});resolveOld(Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[bucket]}));
 await waitFor(()=>expect(within(d).queryByText('USD 71.00',{selector:'p.text-2xl'})).toBeNull());expect(within(d).getByText('USD 9.00',{selector:'p.text-2xl'})).toBeTruthy();
});
it('definite rejection needs explicit canonical no-record correction before a new key',async()=>{
 const {fetcher}=setup();const original=fetcher.getMockImplementation()!;const posts:any[]=[];let rejected=false;
 fetcher.mockImplementation(async(url,init)=>{
  if(url.includes('/outstanding?')&&rejected)return Response.json({ok:true,version:1,affiliateId,scope:'all-time',buckets:[{...bucket,amount:69,allocations:[...allocations,{orderId:'late-refund',amount:-2}]}]});
  if(url.includes('/commands/payout-record/')&&!init?.method)return Response.json({error:{code:'VALIDATION_ERROR',message:'Command not found'}},{status:404});
  if(url.endsWith('/commands/payout-record')){const envelope=JSON.parse(String(init?.body));posts.push(envelope);if(!rejected){rejected=true;return Response.json({error:{code:'VALIDATION_ERROR',message:'New negative adjustment required'}},{status:400});}return Response.json({command:{id:envelope.commandId,kind:'payout-record',state:'committed'},payout:{id:'corrected'}});}
  return original(url,init);
 });
 const d=await open();await within(d).findByText('USD 71.00',{selector:'p'});fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await within(d).findByText('New negative adjustment required');expect(posts).toHaveLength(1);
 fireEvent.click(within(d).getByRole('button',{name:'Verify no record and review correction'}));await within(d).findByText('USD 69.00',{selector:'p'});expect(posts).toHaveLength(1);
 fireEvent.click(within(d).getByRole('button',{name:'Mark as paid'}));await waitFor(()=>expect(posts).toHaveLength(2));expect(posts[1].commandId).not.toBe(posts[0].commandId);expect(posts[1].payload.amount).toBe(69);
});
it('native modal replaces historical85 with canonical71 and sends exact partial/refund allocations',async()=>{
 const {posts,fetcher}=setup();const dialog=await open();
 await within(dialog).findByText('USD 71.00',{selector:'p'});expect(within(dialog).queryByText('$85.00')).toBeNull();
 fireEvent.click(within(dialog).getByRole('button',{name:'Mark as paid'}));await waitFor(()=>expect(posts).toHaveLength(1));
 expect(posts[0].payload.amount).toBe(71);expect(posts[0].payload.allocations).toEqual(allocations);
 expect(fetcher.mock.calls.some(([url])=>url==='/api/affiliates/payouts/outstanding?affiliateId='+affiliateId)).toBe(true);
});
