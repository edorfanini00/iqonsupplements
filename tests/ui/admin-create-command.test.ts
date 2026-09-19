// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import React from 'react';
import {render,fireEvent,screen,cleanup} from '@testing-library/react';
import AffiliatesPage from '../../app/affiliates/admin/affiliates/page';
import {canonicalActionFetch} from '../../lib/affiliates/canonical-action-fetch';
afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals()});
it('manual-create UI does not collect a password rejected by the canonical identity contract',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({affiliates:[],options:[]})));
 render(React.createElement(AffiliatesPage));
 fireEvent.click(screen.getByRole('button',{name:'New'}));
 expect(screen.queryByPlaceholderText('Password*')).toBeNull();
 expect(screen.getByText(/Identity setup is handled by the canonical provider/)).toBeTruthy();
});
it('manual-create form adapter requires current admin, skips nonexistent affiliate version and separates email targets',async()=>{
 const calls:any[]=[];let role='admin';
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{calls.push([url,init]);if(url.includes('shared-session'))return Response.json({version:1,session:{wpUserId:99001,email:'synthetic@local.invalid',role,wpRoles:[role==='admin'?'administrator':'shop_manager'],profile:null}});const body=JSON.parse(init.body);return Response.json({command:{id:body.commandId,kind:'admin-create',state:'committed'},affiliate:{id:body.payload.email},outbox:[{store:'identity',operation:'admin-identity',state:'blocked'}]});}));
 const submit=(email:string)=>canonicalActionFetch('/api/affiliates/admin/create',{method:'POST',body:JSON.stringify({firstName:'Synthetic',lastName:'Create',nickname:'synthetic',email,role:'affiliate',sendEmail:false,password:'LEGACY-MUST-NOT-PERSIST'})});
 expect((await submit('one@local.invalid')).ok).toBe(false);expect((await submit('two@local.invalid')).ok).toBe(false);
 const posts=calls.filter(c=>c[1]?.method==='POST');expect(posts).toHaveLength(2);expect(posts.every(c=>c[0]==='/api/affiliates/commands/admin-create')).toBe(true);
 expect(JSON.parse(posts[0][1].body).expectedVersion).toBeUndefined();expect(JSON.parse(posts[0][1].body).commandId).not.toBe(JSON.parse(posts[1][1].body).commandId);expect(calls.some(c=>c[0].includes('/state/'))).toBe(false);
 expect(posts.every(c=>!('password' in JSON.parse(c[1].body).payload))).toBe(true);
 expect(JSON.stringify(localStorage)).not.toContain('LEGACY-MUST-NOT-PERSIST');
 role='shop_manager';expect((await submit('three@local.invalid')).status).toBe(403);expect(calls.filter(c=>c[1]?.method==='POST')).toHaveLength(2);
});
