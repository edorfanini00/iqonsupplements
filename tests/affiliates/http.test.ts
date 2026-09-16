import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/db/prisma';
import { hashPassword,tokenHash } from '../../lib/affiliates/password';
const base=process.env.AFFILIATE_TEST_BASE_URL;
const dbUrl=process.env.AFFILIATE_TEST_DATABASE_URL;
const enabled=Boolean(base&&dbUrl);
if(enabled){if(!['localhost','127.0.0.1'].includes(new URL(base!).hostname)||!['localhost','127.0.0.1'].includes(new URL(dbUrl!).hostname))throw new Error('HTTP tests require disposable local services.');process.env.SUPPLEMENTS_DATABASE_URL=dbUrl;}
async function call(path:string,method='GET',body?:unknown,cookie?:string,origin=base){
  const response=await fetch(`${base}${path}`,{method,headers:{...(origin?{Origin:origin}:{}),...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
test('HTTP: pending access, role isolation, reset single-use, session revocation, CSRF, and webhook authentication',{skip:!enabled},async()=>{
  const suffix=randomBytes(5).toString('hex');const email=`signup-${suffix}@example.test`;const password='fixture-original-password-2026';
  assert.equal((await call('/api/affiliates/me')).status,401);
  assert.equal((await call('/api/affiliates/admin/affiliates')).status,401);
  const signup={firstName:'HTTP',lastName:'Fixture',email,phone:'5550101234',nickname:`test${suffix}`,password,noReferrer:true};
  assert.equal((await call('/api/affiliates/signup','POST',signup,undefined,'https://other.example')).status,403);
  const created=await call('/api/affiliates/signup','POST',signup);assert.equal(created.status,200,JSON.stringify(created.data));assert.equal(created.data.pending,true);assert.equal(created.data.emailSent,false);
  const pending=await call('/api/affiliates/login','POST',{email,password});assert.equal(pending.status,200);assert.equal(pending.data.pending,true);assert.equal(pending.cookie,undefined);
  await prisma.affiliateProfile.update({where:{email},data:{status:'active'}});
  assert.equal((await call('/api/affiliates/login','POST',{email,password:'wrong-password'})).status,401);
  const login=await call('/api/affiliates/login','POST',{email,password});assert.equal(login.status,200,JSON.stringify(login.data));assert.ok(login.cookie?.startsWith('iqon_supplements_portal='));
  assert.equal((await call('/api/affiliates/me','GET',undefined,login.cookie)).status,200);
  assert.equal((await call('/api/affiliates/dashboard','GET',undefined,login.cookie)).status,200);
  assert.equal((await call('/api/affiliates/admin/affiliates','GET',undefined,login.cookie)).status,403);
  // Admin role comes from the server account, never from user input or a decoded JWT.
  const admin=await prisma.portalAccount.create({data:{email:`admin-${suffix}@example.test`,role:'admin',passwordHash:await hashPassword(password)}});
  const adminLogin=await call('/api/affiliates/login','POST',{email:admin.email,password});assert.equal(adminLogin.status,200);
  assert.equal((await call('/api/affiliates/admin/requests','GET',undefined,adminLogin.cookie)).status,200);
  // Reset tokens are consumed atomically and every previous session is revoked.
  const token=randomBytes(32).toString('hex');await prisma.affiliatePasswordReset.create({data:{email,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+60_000)}});
  const newPassword='fixture-replacement-password-2026';
  assert.equal((await call('/api/affiliates/reset-password','POST',{token,password:newPassword})).status,200);
  assert.equal((await call('/api/affiliates/reset-password','POST',{token,password:newPassword})).status,400);
  assert.equal((await call('/api/affiliates/me','GET',undefined,login.cookie)).status,401);
  const second=await call('/api/affiliates/login','POST',{email,password:newPassword});assert.equal(second.status,200);
  await prisma.affiliateProfile.update({where:{email},data:{status:'disabled'}});
  assert.equal((await call('/api/affiliates/me','GET',undefined,second.cookie)).status,401);
  assert.equal((await call('/api/affiliates/logout','POST',undefined,adminLogin.cookie)).status,200);
  assert.equal((await call('/api/affiliates/me','GET',undefined,adminLogin.cookie)).status,401);
  const webhook=await fetch(`${base}/api/affiliates/webhooks/shopify`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Shop-Domain':'another-business.myshopify.com'},body:'{"id":123}'});assert.equal(webhook.status,401);
  const forgedCron=await fetch(`${base}/api/cron/affiliate-sync`,{headers:{'x-vercel-cron':'1'}});assert.equal(forgedCron.status,401);
  await prisma.$disconnect();
});
