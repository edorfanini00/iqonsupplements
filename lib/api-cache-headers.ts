import { NextResponse } from 'next/server';
export function jsonNoCache(body:unknown,init?:ResponseInit){const response=NextResponse.json(body,init);response.headers.set('Cache-Control','private, no-store');return response;}
