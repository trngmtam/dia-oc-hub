import crypto from 'node:crypto';

const TOKEN_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_VALID_DAYS = 7;

function randomChunk(length: number) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => TOKEN_CHARS[byte % TOKEN_CHARS.length]).join('');
}

export function generateInviteCode(prefix: string) {
  return `${prefix}-${randomChunk(4)}-${randomChunk(4)}-${randomChunk(4)}`;
}

export function hashInviteCode(code: string) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function getInviteExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_VALID_DAYS);
  return expiresAt;
}
