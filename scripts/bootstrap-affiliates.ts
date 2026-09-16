import { PrismaClient } from '@prisma/client';
import { hashPassword,validPassword } from '../lib/affiliates/password';
import { contestPeriod } from '../lib/affiliates/leaderboard';
const email=process.env.SUPPLEMENTS_ADMIN_EMAIL?.trim().toLowerCase();
const password=process.env.SUPPLEMENTS_ADMIN_PASSWORD;
if(!process.env.SUPPLEMENTS_DATABASE_URL||!email||!validPassword(password))throw new Error('Set the supplements database URL, admin email, and a 12–256 character admin password.');
const start=new Date(process.env.SUPPLEMENTS_AFFILIATE_START_AT??new Date().toISOString());
if(!Number.isFinite(start.getTime()))throw new Error('Invalid program start date.');
const db=new PrismaClient();
try{
  await db.$transaction(async tx=>{
    const existing=await tx.portalAccount.findUnique({where:{email}});
    if(existing){if(existing.role!=='admin')throw new Error('This email already belongs to an affiliate. Choose a separate admin email.');}
    else{
      const account=await tx.portalAccount.create({data:{email,passwordHash:await hashPassword(password),role:'admin'}});
      await tx.affiliateProfile.create({data:{portalUserId:account.id,email,firstName:'IQON',lastName:'Admin',phone:'',promoCode:`HOUSE${account.id}`,portalRole:'admin',status:'active',commissionRate:0,recurringCommissionRate:0,couponRate:0}});
    }
    await tx.leaderboardSettlementState.upsert({where:{id:'default'},create:{id:'default',firstCycleStart:contestPeriod(start).start},update:{}});
    await tx.appPortalConfig.upsert({where:{id:'supplements-program'},create:{id:'supplements-program',json:JSON.stringify({startedAt:start.toISOString()})},update:{}});
    await tx.appPortalConfig.upsert({where:{id:'supplements-shopify-sync'},create:{id:'supplements-shopify-sync',json:JSON.stringify({from:start.toISOString()})},update:{}});
  });
  console.log('Supplements administrator and program initialized. Existing credentials were left intact.');
}finally{await db.$disconnect();}
