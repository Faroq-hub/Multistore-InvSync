import crypto from 'node:crypto';

// Lazy-load the encryption key to avoid crashing if ENCRYPTION_KEY is not set
let cachedKey: Buffer | null | undefined = undefined;

function getKey(): Buffer | null {
  // Return cached key if already computed
  if (cachedKey !== undefined) {
    return cachedKey;
  }
  
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    cachedKey = null;
    return null; // Return null instead of throwing - allows graceful degradation
  }

  try {
    let key: Buffer;
    if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
      key = Buffer.from(secret, 'hex');
    } else {
      key = Buffer.from(secret, 'base64');
    }

    if (key.length !== 32) {
      console.warn('[Crypto] ENCRYPTION_KEY must be a 32-byte key in hex (64 chars) or base64 encoding');
      cachedKey = null;
      return null;
    }

    cachedKey = key;
    return key;
  } catch (error) {
    console.warn('[Crypto] Failed to parse ENCRYPTION_KEY:', error);
    cachedKey = null;
    return null;
  }
}

export function encryptString(value: string): string {
  const KEY = getKey();
  if (!KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot encrypt value.');
  }
  
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptString(payload: string): string {
  const KEY = getKey();
  if (!KEY) {
    throw new Error('ENCRYPTION_KEY not configured. Cannot decrypt value.');
  }
  
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

