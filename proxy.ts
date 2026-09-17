import { NextRequest, NextResponse } from 'next/server';
import { relayAffiliateRequest } from '@/lib/affiliates/shared-relay';
export async function proxy(request: NextRequest) {
  const response = request.nextUrl.pathname.startsWith('/api/cron/')
    ? NextResponse.json({ok:false,error:'Health owns affiliate scheduled jobs'}, {status:410})
    : await relayAffiliateRequest(request);
  // BFF validates exact configured origin and never falls through to local DB.
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag','noindex, nofollow');
  return response;
}
export const config = {matcher: ['/api/affiliates/:path*','/api/cron/:path*']};
