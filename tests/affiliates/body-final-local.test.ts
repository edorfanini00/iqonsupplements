import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createCommandClient} from '../../lib/affiliates/canonical-command-client';
import {parseBodySession} from '../../lib/affiliates/body-session-dto';
/** Opt-in only: requires the declared synthetic two-Next/disposable-DB harness.
 * No production URL override and no real cookies/credentials accepted. */
test('actual final Health HTTP DTOs, Body session projection, rejected correction and dropped-response retries',{skip:process.env.IQON_FINAL_LOCAL_INTEGRATION!=='1'},async()=>{
 const token=(id:number)=>{const enc=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString('base64url');const s=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:String(id),exp:Math.floor(Date.now()/1000)+3600});return s+'.'+createHmac('sha256','declared-local-fixture-jwt-secret-not-production').update(s).digest('base64url')};
 const traces:any[]=[];
 const transport=(port:number,actor=99001)=>async(url:string,init?:RequestInit)=>{
  const path=port===34531?url.replace('/api/affiliates/commands/','/api/integrations/body/commands/'):url;
  const response=await fetch(`https://localhost:${port}${path}`,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),cookie:'iqon_affiliate_wp_jwt='+token(actor),origin:`https://localhost:${port}`}});
  traces.push({port,path,method:init?.method??'GET',status:response.status,body:init?.body?JSON.parse(String(init.body)):undefined,response:await response.clone().json()});return response;
 };
 for(const [id,role] of [[99001,'admin'],[99002,'affiliate'],[99004,'shop_manager']] as const){
  const dto=await (await transport(34532,id)('/api/affiliates/shared-session')).json();const s=parseBodySession(dto);assert.ok(s);assert.equal(s.role,role);assert.equal(s.portalUserId,id);assert.equal(s.wpUserId,id);assert.deepEqual(s.portalRoles,dto.session.wpRoles);assert.deepEqual(s.profile,dto.session.profile);
 }
 const storage=()=>{const map=new Map<string,string>();return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)},removeItem:(k:string)=>{map.delete(k)}}};
 const rejected=createCommandClient({storage:storage(),fetch:transport(34532),uuid:randomUUID});
 const invalid=await rejected.submit('wp:99001','payout-record',{affiliateId:'fixture-affiliate',method:'other',amount:-100});assert.equal(invalid.status,400);assert.equal((await invalid.json()).error,'Invalid command payload');
 assert.equal(await rejected.allowCorrection('wp:99001',rejected.list('wp:99001')[0]),true);
 const settings=createCommandClient({storage:storage(),fetch:transport(34532),uuid:randomUUID});
 const stale=await settings.submit('wp:99001','commission-settings',{affiliateId:'fixture-affiliate',commissionRate:0},999999);assert.equal(stale.status,409);assert.equal(settings.list('wp:99001').filter(a=>!a.archived).length,0);
 for(const failure of ['before-dispatch','after-commit'] as const){
  const store=storage();let lost=true;const bodies:string[]=[];let committedId='';
  const client=createCommandClient({storage:store,uuid:randomUUID,fetch:async(url,init)=>{
   if(init?.method==='POST')bodies.push(String(init.body));
   if(lost&&failure==='before-dispatch'){lost=false;throw Error('Synthetic disconnect before dispatch')}
   const r=await transport(34532)(url,init);
   if(lost){lost=false;committedId=(await r.clone().json()).payout.id;throw Error('Synthetic disconnect after committed response')}
   return r;
  }});
  const payload={affiliateId:'fixture-affiliate',method:'other',reference:`LOCAL TEST ${failure}`,allocations:[{orderId:'fixture-peptide',amount:1}]};
  assert.equal((await client.submit('wp:99001','payout-record',payload)).ok,false);
  const retry=await client.submit('wp:99001','payout-record',payload);assert.equal(retry.ok,true,JSON.stringify(await retry.json()));assert.equal(bodies[0],bodies[1]);
  const saved=client.list('wp:99001')[0];const remote=await transport(34531)(`/api/affiliates/commands/payout-record/${saved.envelope.commandId}`);const dto=await remote.json();assert.equal(dto.command.id,saved.envelope.commandId);if(committedId)assert.equal(dto.payout.id,committedId);
  const replay=await transport(34531)('/api/affiliates/commands/payout-record',{method:'POST',headers:{'content-type':'application/json'},body:bodies[0]});assert.equal((await replay.json()).payout.id,dto.payout.id);
 }
 if(process.env.IQON_LOCAL_EVIDENCE)writeFileSync(process.env.IQON_LOCAL_EVIDENCE,JSON.stringify({boundary:'Real localhost Next transport; synthetic identity; disposable DB; no provider writes',traces},null,2));
});
