-- Additive: IQON Body customer-account sessions (see docs/customer-accounts.md).
-- The browser holds only an opaque "id.secret" cookie; this row is the session of record.
-- tokens is AES-256-GCM sealed (key from CUSTOMER_ACCOUNT_SESSION_SECRET, row id as context);
-- secret_hash is an HMAC of the cookie secret. No plaintext provider credentials are stored.
-- Rollback: revert the application code and leave this additive table in place. Only if the
-- table itself must be removed afterwards: DROP TABLE "customer_account_sessions";
-- CreateTable
CREATE TABLE "customer_account_sessions" (
    "id" VARCHAR(64) NOT NULL,
    "secret_hash" VARCHAR(64) NOT NULL,
    "customer_sub" TEXT NOT NULL,
    "tokens" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "refresh_lease_owner" VARCHAR(64),
    "refresh_lease_until" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_account_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_account_sessions_expires_at_idx" ON "customer_account_sessions"("expires_at");
