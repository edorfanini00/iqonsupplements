-- Additive: remember that an earlier send attempt may have reached Resend, so a
-- row older than Resend's 24h idempotency window is never sent again.
-- Rollback: ALTER TABLE "supplements_transactional_emails" DROP COLUMN "send_uncertain";
-- AlterTable
ALTER TABLE "supplements_transactional_emails" ADD COLUMN "send_uncertain" BOOLEAN NOT NULL DEFAULT false;
