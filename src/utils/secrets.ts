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
 */
export function encryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    return encryptString(value);
  } catch (error) {
    console.error('[Secrets] Failed to encrypt value:', error);
    // In case of encryption failure, we should not store plain text
    // Return null to indicate encryption failure
    throw new Error('Failed to encrypt sensitive data. Check ENCRYPTION_KEY configuration.');
  }
}

/**
 * Decrypt a sensitive value retrieved from database
 * Returns null if value is null/undefined, otherwise returns decrypted string
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    return decryptString(value);
  } catch (error) {
    console.error('[Secrets] Failed to decrypt value:', error);
    // If decryption fails, it might be plain text from old records
    // Try to return as-is (for backward compatibility during migration)
    // In production, you might want to log this and handle it differently
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

