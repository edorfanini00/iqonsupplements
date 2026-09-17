/**
 * Contact message persistence (public Contact Us form → admin inbox).
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";

export type ContactMessageStatus = "new" | "read" | "replied" | "archived";

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactMessageStatus;
  readAt: string | null;
  repliedAt: string | null;
  createdAt: string;
}

interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  readAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
}

function mapMessage(row: ContactMessageRow): ContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    status: (row.status as ContactMessageStatus) ?? "new",
    readAt: row.readAt ? row.readAt.toISOString() : null,
    repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createContactMessage(input: {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<ContactMessage> {
  const row = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject?.trim() ? input.subject.trim() : null,
      message: input.message,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
  return mapMessage(row);
}

export async function getContactMessage(id: string): Promise<ContactMessage | null> {
  try {
    const row = await prisma.contactMessage.findUnique({ where: { id } });
    return row ? mapMessage(row) : null;
  } catch {
    return null;
  }
}

export async function listContactMessages(options?: {
  status?: ContactMessageStatus;
  limit?: number;
}): Promise<ContactMessage[]> {
  const rows = await prisma.contactMessage.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 200,
  });
  return rows.map(mapMessage);
}

export async function countUnreadContactMessages(): Promise<number> {
  return prisma.contactMessage.count({ where: { status: "new" } });
}

export async function setContactMessageStatus(
  id: string,
  status: ContactMessageStatus
): Promise<ContactMessage | null> {
  try {
    const row = await prisma.contactMessage.update({
      where: { id },
      data: {
        status,
        readAt: status === "new" ? null : new Date(),
      },
    });
    return mapMessage(row);
  } catch {
    return null;
  }
}

/** Mark a message as replied (sets status + repliedAt, and readAt if unset). */
export async function markContactMessageReplied(
  id: string
): Promise<ContactMessage | null> {
  try {
    const now = new Date();
    const existing = await prisma.contactMessage.findUnique({ where: { id } });
    if (!existing) return null;
    const row = await prisma.contactMessage.update({
      where: { id },
      data: {
        status: "replied",
        repliedAt: now,
        readAt: existing.readAt ?? now,
      },
    });
    return mapMessage(row);
  } catch {
    return null;
  }
}

export async function deleteContactMessage(id: string): Promise<boolean> {
  try {
    await prisma.contactMessage.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
