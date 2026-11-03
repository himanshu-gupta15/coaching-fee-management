import crypto from 'crypto';

export function randomCode(len = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function generateTransactionId(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `TXN-${ymd}-${randomCode(8)}`;
}

export function generateReceiptNumber(date = new Date()): string {
  const ym = date.toISOString().slice(0, 7).replace('-', '');
  return `RCPT-${ym}-${randomCode(6)}`;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
