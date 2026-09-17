/** TWO-SERVER LOCAL SIMULATION. Real Body BFF + client over HTTP; credentials,
 * authority receipts/provider results are synthetic. Not live sign-in, a DB
 * transaction test, nor production financial acceptance. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCommandClient} from '../../lib/affiliates/canonical-command-client';
test('two-server command transport: independent simulated login, lost response, stable retry and canonical authorization',async(t)=>{
 let role='admin';const secret='synthetic-only-command-relay-credential';
 const receipts=new Map<string,{body:string;result:any}>();let effects=0;
 const authority=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://localhost');res.setHeader('content-type','application/json');
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const raw=Buffer.concat(chunks).toString();
  if(url.pathname==='/api/affiliates/login'){
   const credentials=JSON.parse(raw);if(credentials.email!=='synthetic@example.test'||credentials.password!=='synthetic-only-password'){res.statusCode=401;res.end('{}');return;}
   res.setHeader('set-cookie','iqon_affiliate_wp_jwt=synthetic-command-session; Path=/; HttpOnly');res.end('{"ok":true}');return;
  }
  if(req.headers.cookie!=='iqon_affiliate_wp_jwt=synthetic-command-session'||role!=='admin'){res.statusCode=403;res.end('{"error":"CURRENT_ROLE_DENIED"}');return;}
  if(req.headers.origin!==health)assert.equal(req.headers['x-iqon-relay-secret'],secret);
  const [,kind,id]=/^\/api\/integrations\/body\/commands\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname)??[];
  if(!kind){res.statusCode=404;res.end('{}');return;}
  if(req.method==='GET'){const r=receipts.get(kind+':'+id);res.statusCode=r?200:404;res.end(JSON.stringify(r?.result??{error:'COMMAND_NOT_FOUND'}));return;}
  const envelope=JSON.parse(raw);const key=kind+':'+envelope.commandId;let r=receipts.get(key);
  if(r&&r.body!==raw){res.statusCode=409;res.end('{"error":"COMMAND_CONFLICT"}');return;}
  if(!r){effects++;r={body:raw,result:{ok:true,command:{id:envelope.commandId,kind,state:'committed'},payout:{id:'synthetic-payout'}}};receipts.set(key,r);}
  res.end(JSON.stringify(r.result));
 });
 await new Promise<void>(resolve=>authority.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>authority.close(()=>resolve())));
 const health=`http://127.0.0.1:${(authority.address() as {port:number}).port}`;
 const child=fork(fileURLToPath(new URL('./fixtures/shared-bff-server.ts',import.meta.url)),[],{execArgv:['--import','tsx'],env:{...process.env,NODE_ENV:'test',SHARED_AFFILIATE_ALLOW_LOOPBACK:'1',SHARED_AFFILIATE_HEALTH_ORIGIN:health,SHARED_AFFILIATE_RELAY_SECRET:secret},stdio:['ignore','ignore','pipe','ipc']});t.after(()=>child.kill('SIGTERM'));
 const port=await new Promise<number>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('BFF timeout')),10000);child.once('message',(m:any)=>{clearTimeout(timer);resolve(m.port)});child.once('error',reject)});const body=`http://127.0.0.1:${port}`;
 const login=async(origin:string)=>{const r=await fetch(origin+'/api/affiliates/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',password:'synthetic-only-password'})});assert.equal(r.status,200);return r.headers.getSetCookie()[0].split(';')[0];};
 const bodyCookie=await login(body),healthCookie=await login(health);
 const saved=new Map<string,string>();const storage={getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v)},removeItem:(k:string)=>{saved.delete(k)}};let drop=true;
 const client=createCommandClient({storage,uuid:()=> '87bfc143-8302-4073-b184-a000ee947ff1',fetch:async(url,init)=>{const r=await fetch(body+url,{...init,headers:{...init?.headers,origin:body,cookie:bodyCookie}});if(drop&&init?.method==='POST'){drop=false;await r.arrayBuffer();throw Error('synthetic lost response AFTER authority commit');}return r;}});
 const payload={affiliateId:'synthetic-affiliate',amount:10,method:'bank'};
 assert.equal((await client.submit('wp:1','payout-record',payload)).ok,false);assert.equal(effects,1);
 const retry=await client.submit('wp:1','payout-record',payload);assert.equal(retry.ok,true);assert.equal(effects,1);
 const attempt=client.list('wp:1')[0];const direct=await fetch(health+'/api/integrations/body/commands/payout-record',{method:'POST',headers:{origin:health,cookie:healthCookie,'content-type':'application/json'},body:JSON.stringify(attempt.envelope)});assert.equal(direct.status,200);assert.deepEqual(await direct.json(),await retry.json());assert.equal(effects,1);
 const conflict=await fetch(body+'/api/affiliates/commands/payout-record',{method:'POST',headers:{origin:body,cookie:bodyCookie,'content-type':'application/json'},body:JSON.stringify({...attempt.envelope,payload:{...payload,amount:99}})});assert.equal(conflict.status,409);assert.equal(effects,1);
 role='affiliate';assert.equal((await client.check('wp:1',attempt)).status,403);assert.equal(effects,1);
});
