/**
 * Internal admin notes persistence. Free-form notes the admin team writes about
 * orders, customers, or operations. Server-only.
 */

import { prisma } from "@/lib/db/prisma";

export interface AdminNote {
  id: string;
  title: string | null;
  body: string;
  tag: string | null;
  pinned: boolean;
  authorEmail: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminNoteRow {
  id: string;
  title: string | null;
  body: string;
  tag: string | null;
  pinned: boolean;
  authorEmail: string;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapNote(row: AdminNoteRow): AdminNote {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tag: row.tag,
    pinned: row.pinned,
    authorEmail: row.authorEmail,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function listAdminNotes(limit = 500): Promise<AdminNote[]> {
  const rows = await prisma.adminNote.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return rows.map(mapNote);
}

export async function createAdminNote(input: {
  title?: string | null;
  body: string;
  tag?: string | null;
  pinned?: boolean;
  authorEmail: string;
  authorName?: string | null;
}): Promise<AdminNote> {
  const row = await prisma.adminNote.create({
    data: {
      title: clean(input.title),
      body: input.body.trim(),
      tag: clean(input.tag),
      pinned: input.pinned ?? false,
      authorEmail: input.authorEmail,
      authorName: clean(input.authorName),
    },
  });
  return mapNote(row);
}

export async function updateAdminNote(
  id: string,
  patch: {
    title?: string | null;
    body?: string;
    tag?: string | null;
    pinned?: boolean;
  }
): Promise<AdminNote | null> {
  try {
    const row = await prisma.adminNote.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: clean(patch.title) } : {}),
        ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
        ...(patch.tag !== undefined ? { tag: clean(patch.tag) } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      },
    });
    return mapNote(row);
  } catch {
    return null;
  }
}

export async function deleteAdminNote(id: string): Promise<boolean> {
  try {
    await prisma.adminNote.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}
