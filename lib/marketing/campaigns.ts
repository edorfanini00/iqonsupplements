/**
 * Drip email campaigns: persistence + the daily batch runner.
 *
 * A campaign freezes its recipient list at creation. Every day the cron (or
 * the admin's "send next batch" button) emails the next `dailyLimit` queued
 * recipients through the branded outreach mailer, until the queue is empty and
 * the campaign completes. Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import { sendCustomerOutreachEmails } from "@/lib/customers/mailer";

export interface CampaignRecipientDto {
  id: string;
  email: string;
  firstName: string | null;
  status: "queued" | "sent" | "failed";
  sentAt: string | null;
  error: string | null;
}

export interface CampaignDto {
  id: string;
  subject: string;
  message: string;
  dailyLimit: number;
  status: "active" | "paused" | "completed";
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  queued: number;
  /** ISO timestamp of the most recent send, if any. */
  lastSentAt: string | null;
}

function normalizeStatus(s: string): CampaignDto["status"] {
  return s === "paused" || s === "completed" ? s : "active";
}

function normalizeRecipientStatus(s: string): CampaignRecipientDto["status"] {
  return s === "sent" || s === "failed" ? s : "queued";
}

type CampaignRow = {
  id: string;
  subject: string;
  message: string;
  dailyLimit: number;
  status: string;
  createdAt: Date;
  recipients: { status: string; sentAt: Date | null }[];
};

function mapCampaign(row: CampaignRow): CampaignDto {
  const sent = row.recipients.filter((r) => r.status === "sent").length;
  const failed = row.recipients.filter((r) => r.status === "failed").length;
  const lastSentAt = row.recipients.reduce<Date | null>(
    (max, r) => (r.sentAt && (max === null || r.sentAt > max) ? r.sentAt : max),
    null
  );
  return {
    id: row.id,
    subject: row.subject,
    message: row.message,
    dailyLimit: row.dailyLimit,
    status: normalizeStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    total: row.recipients.length,
    sent,
    failed,
    queued: row.recipients.length - sent - failed,
    lastSentAt: lastSentAt ? lastSentAt.toISOString() : null,
  };
}

export async function listCampaigns(): Promise<CampaignDto[]> {
  const rows = await prisma.emailCampaign.findMany({
    include: { recipients: { select: { status: true, sentAt: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapCampaign);
}

export async function getCampaign(id: string): Promise<CampaignDto | null> {
  const row = await prisma.emailCampaign.findUnique({
    where: { id },
    include: { recipients: { select: { status: true, sentAt: true } } },
  });
  return row ? mapCampaign(row) : null;
}

export async function listCampaignRecipients(
  campaignId: string
): Promise<CampaignRecipientDto[]> {
  const rows = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    firstName: r.firstName,
    status: normalizeRecipientStatus(r.status),
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    error: r.error,
  }));
}

export async function createCampaign(input: {
  subject: string;
  message: string;
  dailyLimit: number;
  recipients: { email: string; firstName?: string }[];
}): Promise<CampaignDto> {
  const seen = new Set<string>();
  const recipients = input.recipients
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      firstName: r.firstName?.trim() || null,
    }))
    .filter((r) => {
      if (!r.email.includes("@") || seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });

  const row = await prisma.emailCampaign.create({
    data: {
      subject: input.subject.trim(),
      message: input.message.trim(),
      dailyLimit: Math.max(1, Math.floor(input.dailyLimit)),
      recipients: { create: recipients },
    },
    include: { recipients: { select: { status: true, sentAt: true } } },
  });
  return mapCampaign(row);
}

export async function setCampaignStatus(
  id: string,
  status: "active" | "paused"
): Promise<boolean> {
  try {
    // A completed campaign stays completed — there is nothing left to send.
    const res = await prisma.emailCampaign.updateMany({
      where: { id, status: { not: "completed" } },
      data: { status },
    });
    return res.count === 1;
  } catch {
    return false;
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    await prisma.emailCampaign.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export interface BatchRunResult {
  campaignId: string;
  attempted: number;
  sent: number;
  failed: number;
  completed: boolean;
  skipped?: string;
}

/** Start of the current UTC day — the drip guard boundary. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Send the next batch (up to dailyLimit) of queued recipients for one
 * campaign. With `force` false (the cron), a campaign that already sent
 * anything today is skipped so retried/overlapping cron runs can't
 * double-send; the admin's "send next batch" button passes force=true.
 */
export async function runCampaignBatch(
  campaignId: string,
  opts?: { force?: boolean }
): Promise<BatchRunResult> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) {
    return { campaignId, attempted: 0, sent: 0, failed: 0, completed: false, skipped: "Campaign not found" };
  }
  if (campaign.status !== "active") {
    return {
      campaignId,
      attempted: 0,
      sent: 0,
      failed: 0,
      completed: campaign.status === "completed",
      skipped: `Campaign is ${campaign.status}`,
    };
  }

  if (!opts?.force) {
    const sentToday = await prisma.emailCampaignRecipient.count({
      where: { campaignId, sentAt: { gte: startOfTodayUtc() } },
    });
    if (sentToday > 0) {
      return {
        campaignId,
        attempted: 0,
        sent: 0,
        failed: 0,
        completed: false,
        skipped: "Already sent today's batch",
      };
    }
  }

  const batch = await prisma.emailCampaignRecipient.findMany({
    where: { campaignId, status: "queued" },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, campaign.dailyLimit),
  });

  if (batch.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    return { campaignId, attempted: 0, sent: 0, failed: 0, completed: true };
  }

  const result = await sendCustomerOutreachEmails(
    batch.map((r) => ({ email: r.email, firstName: r.firstName ?? undefined })),
    campaign.subject,
    campaign.message
  );

  // The batch mailer reports chunk-level success; a batch this small (daily
  // limit) is one chunk, so treat the whole batch uniformly.
  const ok = result.failed === 0;
  await prisma.emailCampaignRecipient.updateMany({
    where: { id: { in: batch.map((r) => r.id) } },
    data: ok
      ? { status: "sent", sentAt: new Date(), error: null }
      : { status: "failed", error: result.error ?? "Send failed" },
  });

  const remaining = await prisma.emailCampaignRecipient.count({
    where: { campaignId, status: "queued" },
  });
  if (remaining === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
  }

  return {
    campaignId,
    attempted: batch.length,
    sent: ok ? batch.length : 0,
    failed: ok ? 0 : batch.length,
    completed: remaining === 0,
  };
}

/** Run the daily batch for every active campaign (cron entry point). */
export async function processDueCampaigns(): Promise<BatchRunResult[]> {
  const active = await prisma.emailCampaign.findMany({
    where: { status: "active" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const results: BatchRunResult[] = [];
  for (const c of active) {
    try {
      results.push(await runCampaignBatch(c.id));
    } catch (err) {
      console.error("[marketing/campaigns] batch failed", { campaignId: c.id, err });
      results.push({
        campaignId: c.id,
        attempted: 0,
        sent: 0,
        failed: 0,
        completed: false,
        skipped: err instanceof Error ? err.message : "Batch error",
      });
    }
  }
  return results;
}
