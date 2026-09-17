import { z } from 'zod';
import { createContactMessage } from '@/lib/contact/store';
import { enforceRateLimit,getClientIp } from '@/lib/affiliates/rate-limit';
import { isDatabaseConfigured } from '@/lib/db/database';
import { apiError,apiSuccess } from '@/lib/affiliates/api-response';
const schema=z.object({name:z.string().trim().min(1).max(120),email:z.string().trim().email().max(254),subject:z.string().trim().max(160).optional(),message:z.string().trim().min(10).max(5000),companyWebsite:z.string().optional()});
export async function POST(request:Request){
  if(!isDatabaseConfigured())return apiError('UNAVAILABLE','The affiliate inbox is being connected. Please try again later.',503);
  try{const body=schema.safeParse(await request.json());if(!body.success)return apiError('INVALID','Please complete your name, email and message.',400);if(body.data.companyWebsite)return apiSuccess({});if(!(await enforceRateLimit(request,'contact',5,900_000)).allowed)return apiError('RATE_LIMITED','Please try again later.',429);await createContactMessage({...body.data,email:body.data.email.toLowerCase(),ip:getClientIp(request),userAgent:request.headers.get('user-agent')});return apiSuccess({});}catch{return apiError('UNAVAILABLE','We could not save your message. Please try again.',503);}
}
