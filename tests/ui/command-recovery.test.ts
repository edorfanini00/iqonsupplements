// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {CommandRecovery} from '../../components/affiliates/shared/CommandRecovery';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('recovers exact pending attempt without declaring success or changing key',async()=>{
 const id='87bfc143-8302-4073-b184-a000ee947ff1';
 localStorage.setItem('iqon-body:canonical-attempts:v1:wp:1',JSON.stringify({'payout-record:a':{kind:'payout-record',envelope:{version:1,commandId:id,payload:{affiliateId:'a',method:'bank',amount:10}},state:'pending',createdAt:'2026-09-17T00:00:00.000Z'}}));
 const calls:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url,init)=>{calls.push([url,init]);if(url.includes('shared-session'))return Response.json({version:1,session:{wpUserId:1,email:'synthetic@test.test',role:'admin',wpRoles:['administrator'],profile:null}});return Response.json({ok:true,command:{id,kind:'payout-record',state:'pending'}});}));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 await act(async()=>root.render(React.createElement(CommandRecovery)));
 expect(host.textContent).toContain(id);expect(host.textContent).toContain('Command recovery');
 const button=[...host.querySelectorAll('button')].find(b=>b.textContent==='Retry saved attempt')!;
 await act(async()=>button.click());
 const sent=calls.find(c=>c[1]?.method==='POST');expect(JSON.parse(sent[1].body).commandId).toBe(id);expect(host.textContent).toContain('Not confirmed complete');expect(host.textContent).not.toContain('Canonical completion verified');
 await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();
});
