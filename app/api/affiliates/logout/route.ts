import { NextResponse } from 'next/server';
import { AFFILIATE_SESSION_COOKIE, AFFILIATE_COOKIE_OPTIONS, revokeCurrentSession } from '@/lib/affiliates/session';
export async function POST() {
  await revokeCurrentSession();
  const response=NextResponse.json({ok:true});
  response.cookies.set(AFFILIATE_SESSION_COOKIE,'',{...AFFILIATE_COOKIE_OPTIONS,maxAge:0});
  return response;
}
