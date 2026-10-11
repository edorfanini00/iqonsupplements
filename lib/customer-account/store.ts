import type { PrismaClient } from "@prisma/client";

// Durable session records in the existing PostgreSQL. Every state change is one conditional
// statement; Postgres re-checks the WHERE clause after taking the row lock, so concurrent
// requests on any number of serverless instances apply one at a time against the current row.

export type SessionRow = {
  id: string; secretHash: string; customerSub: string; tokens: string; accessExpiresAt: number;
  generation: number; leaseOwner: string | null; leaseUntil: number | null; revokedAt: number | null; expiresAt: number;
};
export type SessionStore = {
  create(row: Omit<SessionRow, "generation" | "leaseOwner" | "leaseUntil" | "revokedAt">, now: number): Promise<void>;
  get(id: string): Promise<SessionRow | null>;
  /** Takes the refresh lease only if the row is live, still at `generation`, and no live lease exists. */
  acquireLease(id: string, generation: number, owner: string, now: number, until: number): Promise<boolean>;
  /** Installs refreshed tokens only for the lease holder of a live row still at `generation`. */
  completeRefresh(id: string, generation: number, owner: string, tokens: string, accessExpiresAt: number, now: number): Promise<boolean>;
  releaseLease(id: string, owner: string, now: number): Promise<void>;
  /** Revokes the row (any generation unless one is given). Revocation is permanent. */
  revoke(id: string, reason: string, now: number, generation?: number): Promise<boolean>;
  /** Removes rows that expired or were revoked more than `graceMs` ago, a few at a time. */
  purge(now: number, graceMs: number, limit: number): Promise<number>;
};

type Raw = {id: string; secret_hash: string; customer_sub: string; tokens: string; access_expires_at: Date; generation: number; refresh_lease_owner: string | null; refresh_lease_until: Date | null; revoked_at: Date | null; expires_at: Date};
const toRow = (r: Raw): SessionRow => ({
  id: r.id, secretHash: r.secret_hash, customerSub: r.customer_sub, tokens: r.tokens, accessExpiresAt: r.access_expires_at.getTime(), generation: r.generation,
  leaseOwner: r.refresh_lease_owner, leaseUntil: r.refresh_lease_until?.getTime() ?? null, revokedAt: r.revoked_at?.getTime() ?? null, expiresAt: r.expires_at.getTime(),
});
const at = (ms: number) => new Date(ms);

export function prismaSessionStore(client: PrismaClient): SessionStore {
  return {
    async create(row, now) {
      await client.$executeRaw`INSERT INTO customer_account_sessions (id, secret_hash, customer_sub, tokens, access_expires_at, generation, created_at, expires_at, updated_at)
        VALUES (${row.id}, ${row.secretHash}, ${row.customerSub}, ${row.tokens}, ${at(row.accessExpiresAt)}, 0, ${at(now)}, ${at(row.expiresAt)}, ${at(now)})`;
    },
    async get(id) {
      const rows = await client.$queryRaw<Raw[]>`SELECT id, secret_hash, customer_sub, tokens, access_expires_at, generation, refresh_lease_owner, refresh_lease_until, revoked_at, expires_at
        FROM customer_account_sessions WHERE id = ${id}`;
      return rows[0] ? toRow(rows[0]) : null;
    },
    async acquireLease(id, generation, owner, now, until) {
      return await client.$executeRaw`UPDATE customer_account_sessions SET refresh_lease_owner = ${owner}, refresh_lease_until = ${at(until)}, updated_at = ${at(now)}
        WHERE id = ${id} AND generation = ${generation} AND revoked_at IS NULL AND expires_at > ${at(now)}
          AND (refresh_lease_until IS NULL OR refresh_lease_until <= ${at(now)})` === 1;
    },
    async completeRefresh(id, generation, owner, tokens, accessExpiresAt, now) {
      return await client.$executeRaw`UPDATE customer_account_sessions SET tokens = ${tokens}, access_expires_at = ${at(accessExpiresAt)}, generation = generation + 1,
          refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ${at(now)}
        WHERE id = ${id} AND generation = ${generation} AND refresh_lease_owner = ${owner} AND revoked_at IS NULL` === 1;
    },
    async releaseLease(id, owner, now) {
      await client.$executeRaw`UPDATE customer_account_sessions SET refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ${at(now)}
        WHERE id = ${id} AND refresh_lease_owner = ${owner}`;
    },
    async revoke(id, reason, now, generation) {
      const count = generation === undefined
        ? await client.$executeRaw`UPDATE customer_account_sessions SET revoked_at = ${at(now)}, revoke_reason = ${reason}, refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ${at(now)}
            WHERE id = ${id} AND revoked_at IS NULL`
        : await client.$executeRaw`UPDATE customer_account_sessions SET revoked_at = ${at(now)}, revoke_reason = ${reason}, refresh_lease_owner = NULL, refresh_lease_until = NULL, updated_at = ${at(now)}
            WHERE id = ${id} AND revoked_at IS NULL AND generation = ${generation}`;
      return count === 1;
    },
    async purge(now, graceMs, limit) {
      return await client.$executeRaw`DELETE FROM customer_account_sessions WHERE id IN (
        SELECT id FROM customer_account_sessions WHERE expires_at <= ${at(now)} OR revoked_at <= ${at(now - graceMs)} LIMIT ${limit})`;
    },
  };
}
