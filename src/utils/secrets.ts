/**
 * Secrets Management Utility
 * 
 * Provides encryption/decryption for sensitive data stored in the database.
 * Uses AES-256-GCM encryption with a key derived from ENCRYPTION_KEY environment variable.
 * 
 * Sensitive fields that should be encrypted:
 * - access_token (Shopify access tokens)
 * - consumer_secret (WooCommerce consumer secrets)
 * 
 * Note: This is a basic implementation. For production, consider using:
 * - AWS KMS, Google Cloud KMS, or Azure Key Vault for key management
 * - Hardware Security Modules (HSM) for high-security environments
 * - Key rotation policies
 */

import { encryptString, decryptString } from '../security/crypto';

/**
 * Encrypt a sensitive value before storing in database
 * Returns null if value is null/undefined, otherwise returns encrypted string
 * 
 * If ENCRYPTION_KEY is not set, returns value as-is (plain text) for backward compatibility.
 * This allows the app to work without encryption during migration.
 */
export function encryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Check if ENCRYPTION_KEY is configured
  if (!process.env.ENCRYPTION_KEY) {
    // No encryption key - store as plain text (backward compatibility)
    // In production, you should always have ENCRYPTION_KEY set
    console.warn('[Secrets] ENCRYPTION_KEY not set - storing value as plain text. This is not recommended for production.');
    return value;
  }
  
  try {
    return encryptString(value);
  } catch (error) {
    console.error('[Secrets] Failed to encrypt value:', error);
    // If encryption fails and we have ENCRYPTION_KEY, this is a critical error
    // But for backward compatibility during migration, return value as-is
    console.warn('[Secrets] Encryption failed, storing as plain text. Check ENCRYPTION_KEY configuration.');
    return value;
  }
}

/**
 * Decrypt a sensitive value retrieved from database
 * Returns null if value is null/undefined, otherwise returns decrypted string
 * 
 * Handles backward compatibility: if decryption fails, assumes value is plain text
 * (for existing records that were stored before encryption was implemented)
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // Check if ENCRYPTION_KEY is configured
  if (!process.env.ENCRYPTION_KEY) {
    // No encryption key - assume value is plain text (backward compatibility)
    return value;
  }
  
  // Check if value appears to be encrypted (base64 format from crypto.ts)
  // Encrypted values are base64 and typically longer than plain tokens
  const isLikelyEncrypted = value.length > 50 && /^[A-Za-z0-9+/=]+$/.test(value);
  
  if (!isLikelyEncrypted) {
    // Value doesn't look encrypted - return as-is (plain text from old records)
    return value;
  }
  
  try {
    return decryptString(value);
  } catch (error) {
    // Decryption failed - might be plain text from old records
    // Return as-is for backward compatibility
    console.warn('[Secrets] Failed to decrypt value, assuming plain text:', error instanceof Error ? error.message : error);
    return value;
  }
}

/**
 * Check if a value appears to be encrypted
 * Encrypted values from our crypto utility have a specific format
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  // Encrypted values from crypto.ts have a specific format (base64 with separator)
  // Adjust this check based on your encryption format
  return value.includes(':') && value.length > 50;
}

