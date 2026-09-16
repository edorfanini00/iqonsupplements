type ReferralProfile = { referrerId: string | null; portalRole: string; status: string };
export class ReferralValidationError extends Error {}
/** Run under the shared graph-write lock, in the same transaction as the write. */
export async function validateReferrer(
  affiliateId: string,
  referrerId: string | null,
  lookup: (id: string) => Promise<ReferralProfile | null>,
): Promise<void> {
  const visited = new Set([affiliateId]);
  let cursor = referrerId;
  while (cursor) {
    if (visited.has(cursor)) throw new ReferralValidationError("Referral assignment would create a cycle (including self-referral).");
    visited.add(cursor);
    const profile = await lookup(cursor);
    if (!profile) throw new ReferralValidationError("Selected referrer not found.");
    if (cursor === referrerId && (!['affiliate', 'admin'].includes(profile.portalRole) || !['active', 'pending'].includes(profile.status))) {
      throw new ReferralValidationError("Referrer must be an active or pending affiliate, or an admin.");
    }
    cursor = profile.referrerId;
  }
}
