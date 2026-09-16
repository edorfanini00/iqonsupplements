/**
 * Encrypt/decrypt affiliate bank info at rest.
 * Server-only.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { BankInfo } from "@/lib/affiliates/types";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SUPPLEMENTS_AFFILIATE_BANK_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) throw new Error("Payment information storage is not configured.");
  return createHash("sha256").update(secret).digest();
}

export function encryptBankInfo(info: BankInfo): { payload: string; last4?: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const json = JSON.stringify(info);
  const encrypted = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  const last4 = info.accountNumber?.trim().slice(-4) || undefined;
  return { payload, last4 };
}

export function decryptBankInfo(payload: string): BankInfo {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(json) as BankInfo;
}
