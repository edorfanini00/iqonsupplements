import { NextRequest,NextResponse } from 'next/server';
export function proxy(request:NextRequest){
  const path=request.nextUrl.pathname;
  if(path==='/api/affiliates/webhooks/shopify')return NextResponse.next();
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){
    const origin=request.headers.get('origin');
    let sameOrigin=false;
    try {const parsed=new URL(origin??'');sameOrigin=['http:','https:'].includes(parsed.protocol)&&parsed.host===(request.headers.get('host')??request.nextUrl.host);} catch {}
    if(!sameOrigin)return NextResponse.json({ok:false,error:'Request origin is not allowed.'},{status:403});
  }
  const response=NextResponse.next();
  response.headers.set('Cache-Control','private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag','noindex, nofollow');
  return response;
}
export const config={matcher:'/api/affiliates/:path*'};
