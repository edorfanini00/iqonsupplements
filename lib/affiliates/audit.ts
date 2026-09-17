/**
 * Audit logging for admin actions.
 * Server-only.
 */

import { prisma } from "@/lib/db/prisma";

export interface AuditInput {
  actorPortalUserId?: number;
  actorEmail?: string;
  action: string;
  targetAffiliateId?: string;
  before?: unknown;
  after?: unknown;
  request?: Request;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await prisma.affiliateAuditLog.create({
      data: {
        actorPortalUserId: input.actorPortalUserId,
        actorEmail: input.actorEmail,
        action: input.action,
        targetAffiliateId: input.targetAffiliateId,
        beforeJson: input.before ? (redactAudit(input.before) as object) : undefined,
        afterJson: input.after ? (redactAudit(input.after) as object) : undefined,
        ip: input.request ? getIp(input.request) : undefined,
        userAgent: input.request?.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (err) {
    console.error("[affiliates/audit]", { action: input.action, err });
  }
}

function getIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return request.headers.get("x-real-ip") ?? undefined;
}


export function redactAudit(value:unknown):unknown {
  if(Array.isArray(value))return value.map(redactAudit);
  if(value && typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/bankInfo|accountNumber|routingNumber|password|token|secret|encryptedPayload/i.test(key)?"[redacted]":redactAudit(item)]));
  return value;
}
