import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && password.length <= 256;
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('Use a password between 12 and 256 characters.');
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [kind, salt, expected] = encoded.split(':');
  if (kind !== 'scrypt' || !salt || !expected || password.length > 256) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const stored = Buffer.from(expected, 'hex');
  return stored.length === actual.length && timingSafeEqual(stored, actual);
}
export function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
