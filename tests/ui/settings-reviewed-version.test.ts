// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {canonicalActionFetch} from '../../lib/affiliates/canonical-action-fetch';
afterEach(()=>{localStorage.clear();vi.unstubAllGlobals();});
it('uses the version the admin reviewed, never a newer silent overwrite version',async()=>{
 const posts:any[]=[];
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  if(url.endsWith('shared-session'))return Response.json({version:1,session:{wpUserId:99001,email:'synthetic@local.invalid',role:'admin',wpRoles:['administrator'],profile:null}});
  if(url.includes('/state/'))return Response.json({affiliateId:'a',version:7});
  posts.push(JSON.parse(init!.body as string));return Response.json({errorDetail:{code:'VERSION_CONFLICT'}},{status:409});
 }));
 await canonicalActionFetch('/api/affiliates/admin/rates',{method:'PUT',body:JSON.stringify({affiliateId:'a',rates:[]})},3);
 expect(posts[0].expectedVersion).toBe(3);
});
