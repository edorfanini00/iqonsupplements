import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
export interface RateLimitResult { allowed:boolean; remaining:number; retryAfterSec?:number }
/** Shared, atomic fixed-window buckets, including across serverless instances. */
export async function checkRateLimit(key:string,limit:number,windowMs:number):Promise<RateLimitResult> {
  const window = Math.floor(Date.now()/windowMs);
  const expiresAt = new Date((window+1)*windowMs);
  const digest = createHash('sha256').update(`${key}:${window}`).digest('hex');
  const bucket = await prisma.portalRateLimit.upsert({where:{key:digest},create:{key:digest,count:1,expiresAt},update:{count:{increment:1}}});
  return {allowed:bucket.count<=limit,remaining:Math.max(0,limit-bucket.count),retryAfterSec:Math.ceil((expiresAt.getTime()-Date.now())/1000)};
}
export function getClientIp(request:Request):string {
  // Vercel overwrites this header; do not trust an arbitrary leftmost XFF value.
  return request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}
export async function enforceRateLimit(request:Request,routeKey:string,limit:number,windowMs:number) {
  return checkRateLimit(`${routeKey}:${getClientIp(request)}`,limit,windowMs);
}
