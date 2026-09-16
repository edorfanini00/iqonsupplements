/**
 * Direct messaging between affiliates and the admin team.
 * One conversation thread per affiliate (keyed by affiliateId).
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";
import { getAllAffiliates } from "@/lib/affiliates/store";

export type MessageSenderRole = "affiliate" | "admin";

export interface AffiliateMessage {
  id: string;
  affiliateId: string;
  senderRole: MessageSenderRole;
  body: string;
  readByAdmin: boolean;
  readByAffiliate: boolean;
  createdAt: string;
}

interface AffiliateMessageRow {
  id: string;
  affiliateId: string;
  senderRole: string;
  body: string;
  readByAdmin: boolean;
  readByAffiliate: boolean;
  createdAt: Date;
}

function mapMessage(row: AffiliateMessageRow): AffiliateMessage {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    senderRole: (row.senderRole as MessageSenderRole) ?? "affiliate",
    body: row.body,
    readByAdmin: row.readByAdmin,
    readByAffiliate: row.readByAffiliate,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Persist a new message. The sender's own side is marked read automatically. */
export async function createAffiliateMessage(input: {
  affiliateId: string;
  senderRole: MessageSenderRole;
  body: string;
}): Promise<AffiliateMessage> {
  const row = await prisma.affiliateMessage.create({
    data: {
      affiliateId: input.affiliateId,
      senderRole: input.senderRole,
      body: input.body,
      readByAdmin: input.senderRole === "admin",
      readByAffiliate: input.senderRole === "affiliate",
    },
  });
  return mapMessage(row);
}

export interface BroadcastRecipient {
  id: string;
  firstName: string;
  email: string;
}

/** Every active (non-admin) affiliate a broadcast should reach. */
export async function listBroadcastRecipients(): Promise<BroadcastRecipient[]> {
  const rows = await prisma.affiliateProfile.findMany({
    where: { portalRole: { not: "admin" }, status: "active" },
    select: { id: true, firstName: true, email: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return rows;
}

/**
 * Write the same admin message into every given affiliate's thread in one
 * bulk insert. Returns how many rows were created.
 */
export async function createAdminBroadcastMessages(
  affiliateIds: string[],
  body: string
): Promise<number> {
  if (affiliateIds.length === 0) return 0;
  const res = await prisma.affiliateMessage.createMany({
    data: affiliateIds.map((affiliateId) => ({
      affiliateId,
      senderRole: "admin",
      body,
      readByAdmin: true,
      readByAffiliate: false,
    })),
  });
  return res.count;
}

/** Full thread for one affiliate, oldest first (chat order). */
export async function listMessagesForAffiliate(
  affiliateId: string
): Promise<AffiliateMessage[]> {
  const rows = await prisma.affiliateMessage.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return rows.map(mapMessage);
}

/** Mark every affiliate-authored message in a thread as read by the admin. */
export async function markThreadReadByAdmin(affiliateId: string): Promise<void> {
  await prisma.affiliateMessage.updateMany({
    where: { affiliateId, senderRole: "affiliate", readByAdmin: false },
    data: { readByAdmin: true },
  });
}

/** Mark every admin-authored message in a thread as read by the affiliate. */
export async function markThreadReadByAffiliate(
  affiliateId: string
): Promise<void> {
  await prisma.affiliateMessage.updateMany({
    where: { affiliateId, senderRole: "admin", readByAffiliate: false },
    data: { readByAffiliate: true },
  });
}

/** Total messages from affiliates the admin hasn't read yet (all threads). */
export async function countUnreadForAdmin(): Promise<number> {
  return prisma.affiliateMessage.count({
    where: { senderRole: "affiliate", readByAdmin: false },
  });
}

/** Messages from the admin this affiliate hasn't read yet. */
export async function countUnreadForAffiliate(
  affiliateId: string
): Promise<number> {
  return prisma.affiliateMessage.count({
    where: { affiliateId, senderRole: "admin", readByAffiliate: false },
  });
}

export interface AdminThreadSummary {
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  promoCode: string;
  lastMessage: string;
  lastSenderRole: MessageSenderRole;
  lastMessageAt: string;
  unreadCount: number;
  totalMessages: number;
}

interface AdminThreadRow {
  affiliateId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  promoCode: string | null;
  lastMessage: string;
  lastSenderRole: string;
  lastMessageAt: Date;
  unreadCount: number;
  totalMessages: number;
}

/**
 * One row per affiliate conversation, with the latest message, the affiliate's
 * name/contact, the admin's unread count and the total — all in a SINGLE query.
 *
 * Uses Postgres `DISTINCT ON` to grab each thread's newest message (backed by
 * the @@index([affiliateId, createdAt])) plus correlated count subqueries, and
 * LEFT JOINs the profile for display fields. This replaces the previous approach
 * that loaded up to 5,000 message rows AND a separate full-roster query just to
 * enrich names — collapsing the admin inbox poll to one billed operation.
 */
export async function listAdminThreads(): Promise<AdminThreadSummary[]> {
  const rows = await prisma.$queryRaw<AdminThreadRow[]>`
    SELECT DISTINCT ON (m.affiliate_id)
      m.affiliate_id AS "affiliateId",
      p.first_name   AS "firstName",
      p.last_name    AS "lastName",
      p.email        AS "email",
      p.promo_code   AS "promoCode",
      m.body         AS "lastMessage",
      m.sender_role  AS "lastSenderRole",
      m.created_at   AS "lastMessageAt",
      (SELECT count(*)::int FROM affiliate_messages u
         WHERE u.affiliate_id = m.affiliate_id
           AND u.sender_role = 'affiliate'
           AND u.read_by_admin = false) AS "unreadCount",
      (SELECT count(*)::int FROM affiliate_messages t
         WHERE t.affiliate_id = m.affiliate_id) AS "totalMessages"
    FROM affiliate_messages m
    LEFT JOIN affiliate_profiles p ON p.id = m.affiliate_id
    ORDER BY m.affiliate_id, m.created_at DESC
  `;

  return rows
    .map((r) => {
      const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim();
      return {
        affiliateId: r.affiliateId,
        affiliateName: name || "Unknown affiliate",
        affiliateEmail: r.email ?? "",
        promoCode: r.promoCode ?? "",
        lastMessage: r.lastMessage,
        lastSenderRole: (r.lastSenderRole as MessageSenderRole) ?? "affiliate",
        lastMessageAt: new Date(r.lastMessageAt).toISOString(),
        unreadCount: Number(r.unreadCount),
        totalMessages: Number(r.totalMessages),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
}

/**
 * Email addresses to notify when an affiliate messages the admin team.
 * Combines admin-role affiliate profiles with any explicitly configured
 * addresses in AFFILIATE_ADMIN_NOTIFY_EMAIL (comma-separated) — the latter
 * covers admins who sign in via WordPress without a local profile.
 */
export async function getAdminNotifyEmails(): Promise<string[]> {
  const emails = new Set<string>();

  const configured = process.env.SUPPLEMENTS_AFFILIATE_ADMIN_NOTIFY_EMAIL;
  if (configured) {
    for (const raw of configured.split(",")) {
      const e = raw.trim().toLowerCase();
      if (e.includes("@")) emails.add(e);
    }
  }

  try {
    const affiliates = await getAllAffiliates();
    for (const a of affiliates) {
      if (a.role === "admin" && a.email?.includes("@")) {
        emails.add(a.email.trim().toLowerCase());
      }
    }
  } catch {
    // If profiles can't be loaded we still fall back to configured emails.
  }

  return Array.from(emails);
}
