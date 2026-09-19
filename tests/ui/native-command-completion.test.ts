// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {canonicalActionFetch} from '../../lib/affiliates/canonical-action-fetch';
import {browserCommandClient} from '../../lib/affiliates/canonical-command-client';
afterEach(()=>{localStorage.clear();vi.unstubAllGlobals()});
it('native approval retains exact attempt while identity/email pending and completes on canonical status',async()=>{
 const posts:any[]=[];let confirmed=false;let id='';
 vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
  if(url.endsWith('shared-session'))return Response.json({version:1,session:{wpUserId:99001,email:'synthetic@local.invalid',role:'admin',wpRoles:['administrator'],profile:null}});
  if(url.includes('/state/'))return Response.json({affiliateId:'fixture',version:4});
  if(init?.method==='POST'){const envelope=JSON.parse(init.body);posts.push(envelope);id=envelope.commandId;}
  return Response.json({command:{id,kind:'affiliate-approval',state:'committed'},outbox:[
   ...['woo','shopify'].map(store=>({store,operation:'public-code',state:'confirmed'})),
   {store:'identity',operation:'admin-identity',state:confirmed?'confirmed':'blocked'},
   {store:'notification',operation:'approval-email',state:confirmed?'confirmed':'pending'},
  ]});
 }));
 const submit=()=>canonicalActionFetch('/api/affiliates/admin/requests/fixture',{method:'POST',body:JSON.stringify({commissionRate:0,couponRate:0})});
 expect((await submit()).ok).toBe(false);
 expect((await submit()).ok).toBe(false);
 expect(posts).toHaveLength(2);expect(posts[1]).toEqual(posts[0]);
 expect(posts[0].expectedVersion).toBe(4);expect(posts[0].payload).toEqual({affiliateId:'fixture',decision:'approve',commissionRate:0,couponRate:0});
 const client=browserCommandClient();const attempt=client.list('wp:99001')[0];
 expect((await client.check('wp:99001',attempt)).ok).toBe(false);
 confirmed=true;expect((await client.check('wp:99001',attempt)).ok).toBe(true);
 expect(posts).toHaveLength(2);
});
