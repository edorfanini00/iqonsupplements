import {relayAffiliateRequest} from '@/lib/affiliates/shared-relay';
export const runtime = 'nodejs';
// Additive category breakdown only — relay to Health provider, no Body store involvement.
export async function GET(request: Request) { return relayAffiliateRequest(request); }
