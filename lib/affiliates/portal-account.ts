import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from './password';
export function generateTemporaryPassword():string { return randomBytes(24).toString('base64url'); }
export interface ProvisionResult { portalUserId:number; temporaryPassword?:string; linkedExisting:boolean }
/** Independent portal identity. Never creates or changes a Shopify customer password. */
export async function provisionAffiliatePortalUser(input:{email:string;firstName:string;lastName:string;password?:string}):Promise<ProvisionResult> {
  const email=input.email.trim().toLowerCase();
  const existing=await prisma.portalAccount.findUnique({where:{email}});
  if(existing) return {portalUserId:existing.id,linkedExisting:true};
  const temporaryPassword=input.password?undefined:generateTemporaryPassword();
  const account=await prisma.portalAccount.create({data:{email,passwordHash:await hashPassword(input.password??temporaryPassword!)}});
  return {portalUserId:account.id,temporaryPassword,linkedExisting:false};
}
