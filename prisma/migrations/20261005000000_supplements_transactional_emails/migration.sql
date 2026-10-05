-- Additive: customer transactional email idempotency ledger.
-- Rollback: DROP TABLE "supplements_transactional_emails";
-- CreateTable
CREATE TABLE "supplements_transactional_emails" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "claim_token" TEXT,
    "order_id" TEXT,
    "resend_message_id" TEXT,
    "last_error" TEXT,
    "snapshot" JSONB,
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplements_transactional_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplements_transactional_emails_kind_dedupe_key_key" ON "supplements_transactional_emails"("kind", "dedupe_key");

-- CreateIndex
CREATE INDEX "supplements_transactional_emails_order_id_idx" ON "supplements_transactional_emails"("order_id");
