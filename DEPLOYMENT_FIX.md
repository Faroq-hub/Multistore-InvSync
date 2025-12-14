# Deployment Fix - Encryption Key Handling

## Issue
The deployment failed because the encryption code was trying to load `ENCRYPTION_KEY` at module initialization time, causing the application to crash if the key was not set.

## Fix Applied
1. **Made encryption key loading lazy** - The key is now loaded only when encryption/decryption is actually needed
2. **Added backward compatibility** - If `ENCRYPTION_KEY` is not set, values are stored/retrieved as plain text
3. **Graceful error handling** - Decryption failures fall back to treating values as plain text (for existing records)

## Changes Made

### `src/security/crypto.ts`
- Changed `getKey()` to return `null` instead of throwing if `ENCRYPTION_KEY` is missing
- Made key loading lazy (cached after first access)
- Added error handling for invalid key formats

### `src/utils/secrets.ts`
- `encryptSecret()` now returns plain text if `ENCRYPTION_KEY` is not set
- `decryptSecret()` detects if value is encrypted or plain text
- Falls back to plain text for backward compatibility

## Railway Environment Variables

Make sure `ENCRYPTION_KEY` is set in Railway:

1. Go to Railway Dashboard → Your Project → Variables
2. Add `ENCRYPTION_KEY` with a 32-byte key:
   - **Hex format**: 64 characters (e.g., `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`)
   - **Base64 format**: 44 characters (e.g., `ASNFZ4mrze8BI0VniavN7wEjRWeJq83vASNFZ4mrze8=`)
3. Generate a secure key:
   ```bash
   # Hex format (64 chars)
   openssl rand -hex 32
   
   # Base64 format (44 chars)
   openssl rand -base64 32
   ```

## Migration Notes

- **Existing connections**: Will continue to work with plain text tokens/secrets
- **New connections**: Will be encrypted if `ENCRYPTION_KEY` is set
- **Mixed mode**: The system handles both encrypted and plain text values

## Verification

After deployment, check logs for:
- `[Secrets] ENCRYPTION_KEY not set - storing value as plain text` (warning, but not fatal)
- `[Crypto] Failed to parse ENCRYPTION_KEY` (if key format is invalid)

The application should start successfully even without `ENCRYPTION_KEY`, but encryption is recommended for production.

