// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {BulkCouponControl} from '../../components/affiliates/shared/BulkCouponControl';
const access=vi.hoisted(()=>({role:'admin'}));
vi.mock('../../lib/affiliates/canonical-action-fetch',()=>({currentCommandActor:async()=>({actor:'wp:1',session:{role:access.role}})}));
afterEach(()=>{access.role="admin";cleanup();localStorage.clear();vi.unstubAllGlobals();});
it('native bulk control persists scope, displays disabled pending store state and recovers on remount',async()=>{
 const calls:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{calls.push(`${init?.method} ${url}`);const raw=localStorage.getItem('iqon:bulk:v1:wp:1');expect(raw).toBeTruthy();return Response.json({version:1,batchId:JSON.parse(raw!).batchId,portal:'supplements',total:1,remaining:1,providerActivation:'disabled',targets:[{affiliateId:'a',commandId:'child',commandVersion:1,state:'pending',outbox:[{store:'shopify',operation:'public-code',state:'blocked',reason:'Terms required'}],events:[]}]});}));
 const view=render(React.createElement(BulkCouponControl));fireEvent.click(await screen.findByRole('button',{name:'Sync Coupons'}));await screen.findByText(/1 of 1 not confirmed/);expect(screen.getByText(/Providers disabled/)).toBeTruthy();expect(screen.getByText(/Terms required/)).toBeTruthy();view.unmount();render(React.createElement(BulkCouponControl));await waitFor(()=>expect(calls.length).toBe(2));expect(calls[0]).toBe('POST /api/affiliates/commands/creator-code-bulk');expect(calls[1]).toMatch(/^GET .*creator-code-bulk\//);
});
it('clears privileged prior status and stops on current role revocation',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({version:1,batchId:JSON.parse(localStorage.getItem('iqon:bulk:v1:wp:1')!).batchId,portal:'supplements',total:0,remaining:0,providerActivation:'disabled',targets:[]})));
 render(React.createElement(BulkCouponControl));fireEvent.click(await screen.findByRole('button',{name:'Sync Coupons'}));await screen.findByRole('status');access.role='affiliate';fireEvent.click(screen.getByRole('button',{name:'Retry / check coupon batch'}));await screen.findByRole('alert');expect(screen.queryByRole('status')).toBeNull();
});
