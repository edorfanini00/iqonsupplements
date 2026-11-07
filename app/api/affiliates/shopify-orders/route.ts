import {relayAffiliateRequest} from '@/lib/affiliates/shared-relay';
export const runtime='nodejs';
export async function GET(request:Request){return relayAffiliateRequest(request);}
