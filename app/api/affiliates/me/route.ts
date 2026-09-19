import {relayAffiliateRequest} from '@/lib/affiliates/shared-relay';
export const runtime = 'nodejs';
// Defense in depth: no independent Body store even outside the proxy hook.
export async function GET(request: Request) { return relayAffiliateRequest(request); }
