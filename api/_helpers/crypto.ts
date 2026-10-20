/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Cryptographic helpers for password and PIN hashing using PBKDF2 (SHA-256)
 * 
 * Versioned Hash Specification (OWASP Compliant):
 * - Version 2 (Current OWASP Standard): 600,000 iterations PBKDF2-HMAC-SHA256, 16-byte random salt.
 * - Version 1 (Legacy): 10,000 iterations PBKDF2-HMAC-SHA256.
 * - Version 0 (Legacy HMAC): HMAC-SHA256 for initial accounts.
 * 
 * Transparent In-Place Rehashing:
 * Existing users with v1/v0 log in seamlessly and are automatically upgraded to v2.
 */

import * as crypto from 'crypto';

export const CURRENT_HASH_VERSION = 2;
export const OWASP_PBKDF2_ITERATIONS = 600000;
export const LEGACY_PBKDF2_ITERATIONS = 10000;

export interface HashSecretRecord {
  version: number;
  algorithm: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  passwordHash: string;
  createdAt: number;
  upgradedAt?: number;
}

/**
 * Generate a cryptographically secure random alphanumeric access code
 * Avoids ambiguous characters like 0, O, 1, I
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
 * Generate random salt for hashing credentials
 */
export function generateSalt(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash an access code using PBKDF2 with configurable iterations (default 600,000 OWASP standard)
 */
export function hashAccessCode(
  code: string,
  salt: string,
  iterations: number = OWASP_PBKDF2_ITERATIONS
): string {
  return crypto
    .pbkdf2Sync(code.trim().toUpperCase(), salt, iterations, 32, 'sha256')
    .toString('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function timingSafeCompare(aHex: string, bHex: string): boolean {
  if (!aHex || !bHex) return false;
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time verification supporting versioned PBKDF2 and backward compatibility with HMAC-SHA256
 */
export function verifyAccessCode(
  inputCode: string,
  salt: string,
  expectedHash: string,
  iterations?: number
): boolean {
  if (!inputCode || !salt || !expectedHash) return false;

  // 1. If explicit stored iterations provided, check that first
  if (iterations) {
    const hash = hashAccessCode(inputCode, salt, iterations);
    if (timingSafeCompare(hash, expectedHash)) return true;
  }

  // 2. Check OWASP standard (600,000 iterations)
  const owaspHash = hashAccessCode(inputCode, salt, OWASP_PBKDF2_ITERATIONS);
  if (timingSafeCompare(owaspHash, expectedHash)) return true;

  // 3. Check legacy PBKDF2 standard (10,000 iterations)
  const legacyHash = hashAccessCode(inputCode, salt, LEGACY_PBKDF2_ITERATIONS);
  if (timingSafeCompare(legacyHash, expectedHash)) return true;

  // 4. Check legacy HMAC-SHA256 for backward compatibility with initial accounts
  try {
    const legacyHmac = crypto
      .createHmac('sha256', salt)
      .update(inputCode.trim().toUpperCase())
      .digest('hex');
    return timingSafeCompare(legacyHmac, expectedHash);
  } catch {
    return false;
  }
}

/**
 * Hash a user or student password using PBKDF2 (case-sensitive)
 */
export function hashPassword(
  password: string,
  salt: string,
  iterations: number = OWASP_PBKDF2_ITERATIONS
): string {
  return crypto
    .pbkdf2Sync(password.trim(), salt, iterations, 32, 'sha256')
    .toString('hex');
}

/**
 * Verify a user or student password using constant-time comparison
 * Checks across Version 2 (600k), Version 1 (10k), and PIN variations
 */
export function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
  iterations?: number
): boolean {
  if (!password || !salt || !expectedHash) return false;

  // 1. If explicit stored iterations provided, check that first
  if (iterations) {
    const hash = hashPassword(password, salt, iterations);
    if (timingSafeCompare(hash, expectedHash)) return true;
  }

  // 2. Check OWASP standard (600,000 iterations)
  const owaspHash = hashPassword(password, salt, OWASP_PBKDF2_ITERATIONS);
  if (timingSafeCompare(owaspHash, expectedHash)) return true;

  // 3. Fallback to legacy PBKDF2 standard (10,000 iterations)
  const legacyHash = hashPassword(password, salt, LEGACY_PBKDF2_ITERATIONS);
  if (timingSafeCompare(legacyHash, expectedHash)) return true;

  // 4. Also fallback to uppercase/accessCode verification for student PINs
  return verifyAccessCode(password, salt, expectedHash, iterations);
}

/**
 * Determines whether a stored credential requires transparent upgrading to Version 2 (OWASP 600,000)
 */
export function needsRehash(storedVersion?: number, storedIterations?: number): boolean {
  if (!storedVersion || storedVersion < CURRENT_HASH_VERSION) return true;
  if (!storedIterations || storedIterations < OWASP_PBKDF2_ITERATIONS) return true;
  return false;
}

/**
 * Create a complete secure HashSecretRecord for new passwords or updates
 */
export function createPasswordHashRecord(
  password: string,
  customSalt?: string
): HashSecretRecord {
  const salt = customSalt || generateSalt();
  const passwordHash = hashPassword(password, salt, OWASP_PBKDF2_ITERATIONS);
  return {
    version: CURRENT_HASH_VERSION,
    algorithm: 'pbkdf2-sha256',
    iterations: OWASP_PBKDF2_ITERATIONS,
    salt,
    passwordHash,
    createdAt: Date.now()
  };
}

/**
 * Create a complete secure HashSecretRecord for access PINs
 */
export function createAccessCodeHashRecord(
  code: string,
  customSalt?: string
): HashSecretRecord {
  const salt = customSalt || generateSalt();
  const passwordHash = hashAccessCode(code, salt, OWASP_PBKDF2_ITERATIONS);
  return {
    version: CURRENT_HASH_VERSION,
    algorithm: 'pbkdf2-sha256',
    iterations: OWASP_PBKDF2_ITERATIONS,
    salt,
    passwordHash,
    createdAt: Date.now()
  };
}
