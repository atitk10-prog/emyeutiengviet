import * as crypto from 'crypto';

/**
 * Generate a cryptographically secure random alphanumeric access code
 * Avoid ambiguous characters like 0, O, 1, I
 */
export function generateAccessCode(length: number = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate a 6-character classroom code
 */
export function generateClassCode(length: number = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Generate random salt for hashing student credentials
 */
export function generateSalt(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash an access code using PBKDF2 with 10,000 iterations (SHA-256)
 * High iteration count prevents brute-force dictionary attacks against short alphanumeric PINs
 */
export function hashAccessCode(code: string, salt: string): string {
  return crypto
    .pbkdf2Sync(code.trim().toUpperCase(), salt, 10000, 32, 'sha256')
    .toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function timingSafeCompare(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex) return false;
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Constant-time verification supporting PBKDF2 and backward compatibility with HMAC-SHA256
 */
export function verifyAccessCode(inputCode: string, salt: string, expectedHash: string): boolean {
  // Check PBKDF2 (current standard)
  const pbkdf2Hash = hashAccessCode(inputCode, salt);
  if (timingSafeCompare(pbkdf2Hash, expectedHash)) {
    return true;
  }

  // Check legacy HMAC-SHA256 for backward compatibility with seeded/legacy accounts
  const legacyHmac = crypto
    .createHmac('sha256', salt)
    .update(inputCode.trim().toUpperCase())
    .digest('hex');
  return timingSafeCompare(legacyHmac, expectedHash);
}

/**
 * Hash a user or student password using PBKDF2 (case-sensitive)
 */
export function hashPassword(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password.trim(), salt, 10000, 32, 'sha256')
    .toString('hex');
}

/**
 * Verify a user or student password using constant-time comparison
 */
export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  if (!password || !salt || !expectedHash) return false;
  const hash = hashPassword(password, salt);
  if (timingSafeCompare(hash, expectedHash)) return true;
  // Also fallback to uppercase/accessCode verification for student PINs
  return verifyAccessCode(password, salt, expectedHash);
}
