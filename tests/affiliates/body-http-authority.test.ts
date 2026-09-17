/** Real HTTP between processes; authority identity/data adapters are SYNTHETIC.
 * This proves BFF transport/isolation, not real WordPress login or financial math.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('HTTP BFF preserves canonical approval, current roles, cookie sessions and all read periods',async(t)=>{
 let active=true;let role='admin';let authenticated=false;
 const secret='local-synthetic-relay-secret-not-production';
 const authority=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://localhost');
  res.setHeader('content-type','application/json');
  if(req.method==='POST' && url.pathname==='/api/affiliates/login'){
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
   const input=JSON.parse(Buffer.concat(chunks).toString());
   assert.deepEqual(input,{email:'existing-health@example.test',password:'synthetic-password'});
   if(req.headers.origin !== health) assert.equal(req.headers['x-iqon-relay-secret'],secret);
   authenticated=true;res.setHeader('set-cookie','iqon_affiliate_wp_jwt=synthetic-token; Domain=health.example.test; Path=/; HttpOnly');res.end(JSON.stringify({ok:true,role}));return;
  }
  if(!authenticated || req.headers.cookie!=='iqon_affiliate_wp_jwt=synthetic-token'){res.statusCode=401;res.end('{"ok":false,"error":"Unauthorized"}');return;}
  if(!active || (url.pathname.includes('/admin/') && role!=='admin')){res.statusCode=403;res.end('{"ok":false,"error":"Denied"}');return;}
  if(url.pathname==='/api/integrations/body/session'){
   res.end(JSON.stringify({version:1,session:{wpUserId:7,email:'existing-health@example.test',role,wpRoles:['customer'],profile:{id:'synthetic-profile',status:'active',firstName:'Test',lastName:'Account',promoCode:'FIXTURE',onboardedAt:null}}}));return;
  }
  const data={ok:true,identity:'synthetic-existing-health-account',role,path:url.pathname,query:url.search,orders:[{id:'synthetic-canonical-order',source:'health',net:125.25}],periodSemantics:url.pathname.includes('rankings')?'13th-12th':url.pathname.endsWith('/app')?'rolling':'requested-range'};
  res.end(JSON.stringify(data));
 });
 await new Promise<void>(resolve=>authority.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise<void>(resolve=>authority.close(()=>resolve())));
 const health=`http://127.0.0.1:${(authority.address() as {port:number}).port}`;
 const child=fork(fileURLToPath(new URL('./fixtures/shared-bff-server.ts',import.meta.url)),[],{execArgv:['--import','tsx'],env:{...process.env,NODE_ENV:'test',SHARED_AFFILIATE_ALLOW_LOOPBACK:'1',SHARED_AFFILIATE_HEALTH_ORIGIN:health,SHARED_AFFILIATE_RELAY_SECRET:secret},stdio:['ignore','ignore','pipe','ipc']});
 t.after(()=>{child.kill('SIGTERM');});
 const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('BFF startup timeout')),10000);child.once('message',(message:any)=>{clearTimeout(timer);resolve(message.port);});child.once('error',reject);});
 const body=`http://127.0.0.1:${port}`;
 const login=()=>fetch(body+'/api/affiliates/login',{method:'POST',headers:{origin:body,'content-type':'application/json'},body:JSON.stringify({email:'existing-health@example.test',password:'synthetic-password'})});
 const csrf=await fetch(body+'/api/affiliates/login',{method:'POST',headers:{origin:'http://foreign.test','content-type':'application/json'},body:'{}'});
 assert.equal(csrf.status,403);assert.equal(authenticated,false);
 const issued=await login();assert.equal(issued.status,200);
 const setCookie=issued.headers.getSetCookie()[0];assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);assert.doesNotMatch(setCookie,/Domain=/);
 const cookie=setCookie.split(';')[0];
 // Independently submit the SAME synthetic credentials on Health, never copy a
 // browser identity as evidence of a password login.
 const directLogin=await fetch(health+'/api/affiliates/login',{method:'POST',headers:{origin:health,'content-type':'application/json'},body:JSON.stringify({email:'existing-health@example.test',password:'synthetic-password'})});
 assert.equal(directLogin.status,200);
 const healthCookie=directLogin.headers.getSetCookie()[0].split(';')[0];
 const directSession=await fetch(health+'/api/integrations/body/session',{headers:{cookie:healthCookie}});
 const bodySession=await fetch(body+'/api/affiliates/shared-session',{headers:{cookie}});
 assert.deepEqual(await bodySession.json(),await directSession.json());
 const paths=['me','admin/dashboard','admin/affiliates','admin/app','admin/rankings','admin/payouts','admin/orders','admin/customers','admin/subscriptions','admin/requests','admin/notes','admin/tiktok','admin/accounting/summary','admin/accounting/trends','admin/messages','admin/affiliate-messages','admin/badges','admin/export'];
 for(const path of paths){for(const range of ['m:2026-08','m:2026-09','m:2025-12','m:2026-01']){
  const route='/api/affiliates/'+path+'?range='+encodeURIComponent(range);
  const canonical=await fetch(health+route,{headers:{cookie}});
  const proxied=await fetch(body+route,{headers:{cookie,authorization:'Bearer forged','x-iqon-relay-secret':'forged'}});
  assert.equal(proxied.status,200,route);assert.deepEqual(await proxied.json(),await canonical.json(),route);assert.match(proxied.headers.get('cache-control')??'',/no-store/);
 }}
 role='affiliate';
 const demotedSession=await fetch(body+'/api/affiliates/shared-session',{headers:{cookie}});
 assert.equal((await demotedSession.json()).session.role,'affiliate');
 assert.equal((await fetch(body+'/api/affiliates/admin/dashboard',{headers:{cookie}})).status,403,'role demotion cannot reuse a prior administrator response');
 assert.equal((await fetch(body+'/api/affiliates/dashboard',{headers:{cookie}})).status,200);
 active=false;
 assert.equal((await fetch(body+'/api/affiliates/dashboard',{headers:{cookie}})).status,403,'disabled approval is checked on the next read');
 active=true;authenticated=false;
 assert.equal((await fetch(body+'/api/affiliates/me',{headers:{cookie}})).status,401,'revoked session is not accepted locally');
 for(const path of ['/api/affiliates/woocommerce-webhook','/api/affiliates/webhooks/shopify','/api/affiliates/admin/orders/123/refund']){
  const blocked=await fetch(body+path,{method:'POST',headers:{origin:body,'content-type':'application/json',cookie},body:'{}'});
  assert.ok([404,501].includes(blocked.status));
 }
});
