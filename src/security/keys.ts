import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function generateApiKey(length = 40): string {
  // URL-safe base64 without padding, truncated to length
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);
}

export function hashApiKey(key: string, salt?: string): { salt: string; hash: string; last4: string } {
  const usedSalt = salt || randomBytes(16).toString('hex');
  const hashBuf = scryptSync(key, usedSalt, 32);
  return { salt: usedSalt, hash: hashBuf.toString('hex'), last4: key.slice(-4) };
}

export function verifyApiKey(key: string, salt: string, expectedHashHex: string): boolean {
  const hashBuf = scryptSync(key, salt, 32);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (expected.length !== hashBuf.length) return false;
  return timingSafeEqual(expected, hashBuf);
}

