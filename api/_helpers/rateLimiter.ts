/**
 * EM YÊU TIẾNG VIỆT - VERCEL SERVERLESS BACKEND
 * Rate Limiter for Login and PIN Verification
 * 
 * Features:
 * 1. Multi-tenant shared state across Vercel Function instances via Firestore.
 * 2. 3-Layer defense protecting Firebase Firestore Spark free quota (50k reads / 20k writes per day):
 *    - Layer 1: In-memory container burst filter (0 quota cost on rapid floods).
 *    - Layer 2: Read-on-Demand (1 Read), Write-on-Failure ONLY (0 Writes for successful normal logins).
 *    - Layer 3: Dual limits (Account-specific: 5 attempts/5min; IP-wide: 20 attempts/5min).
 * 3. Privacy & Zero-PII: Hashes all identifiers (usernames, IPs) using SHA-256 before storing or logging.
 * 4. Concurrency-safe using Firestore transaction and in-memory failover.
 */

import * as crypto from 'crypto';
import { ApiError, VercelApiRequest } from './types.js';
import { getDb } from './firebaseAdmin.js';

interface MemoryBurstRecord {
  count: number;
  resetAt: number;
}

interface MemoryAttemptRecord {
  failedCount: number;
  lockedUntil: number;
  lastFailedAt: number;
}

// In-memory burst filter per serverless instance: blocks ultra-rapid spam (< 3s) with 0 database quota cost
const burstShield = new Map<string, MemoryBurstRecord>();
const BURST_WINDOW_MS = 3000;
const BURST_MAX_REQUESTS = 10;

// In-memory fallback map: ensures rate-limiting functions seamlessly during offline unit tests / cold start
const memoryLimiter = new Map<string, MemoryAttemptRecord>();

/**
 * Hash identifier with SHA-256 to ensure no raw passwords, usernames, or IPs are stored in logs or keys
 */
export function hashKeyComponent(value: string): string {
  if (!value) return 'anonymous';
  return crypto
    .createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
    .substring(0, 24);
}

/**
 * Extract sanitized client IP
 */
export function getClientIp(req: VercelApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

/**
 * Check in-memory burst shield (Layer 1 - 0 Quota)
 */
function checkBurstShield(key: string): void {
  const now = Date.now();
  const record = burstShield.get(key);

  if (!record || now > record.resetAt) {
    burstShield.set(key, { count: 1, resetAt: now + BURST_WINDOW_MS });
    return;
  }

  record.count += 1;
  if (record.count > BURST_MAX_REQUESTS) {
    throw new ApiError(
      429,
      'resource-exhausted',
      'Phát hiện lưu lượng truy cập bất thường từ thiết bị của bạn. Vui lòng thử lại sau vài giây.'
    );
  }
}

/**
 * Rate limit check for an identifier (Layer 2 & 3 - Shared Firestore Spark)
 */
export async function checkRateLimit(
  rawIdentifier: string,
  limit: number = 5,
  windowMs: number = 5 * 60 * 1000
): Promise<{ key: string; failedCount: number }> {
  const hashedKey = `rl_${hashKeyComponent(rawIdentifier)}`;
  const now = Date.now();

  // Layer 1: Check in-memory burst shield
  checkBurstShield(hashedKey);

  // Check in-memory lockout first
  const mem = memoryLimiter.get(hashedKey);
  if (mem && mem.lockedUntil > now) {
    const remainingSeconds = Math.ceil((mem.lockedUntil - now) / 1000);
    throw new ApiError(
      429,
      'resource-exhausted',
      `Tài khoản hoặc thiết bị này tạm thời bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainingSeconds} giây.`
    );
  }

  try {
    const db = getDb();
    const docRef = db.collection('loginAttempts').doc(hashedKey);
    const snap = await docRef.get();

    if (snap.exists) {
      const data = snap.data();
      const lockedUntil = Number(data?.lockedUntil || 0);

      if (lockedUntil > now) {
        const remainingSeconds = Math.ceil((lockedUntil - now) / 1000);
        // Sync in-memory
        memoryLimiter.set(hashedKey, {
          failedCount: data?.failedCount || limit,
          lockedUntil,
          lastFailedAt: data?.lastFailedAt || now
        });
        throw new ApiError(
          429,
          'resource-exhausted',
          `Tài khoản hoặc thiết bị này tạm thời bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${remainingSeconds} giây.`
        );
      }

      const lastFailedAt = Number(data?.lastFailedAt || 0);
      if (now - lastFailedAt > windowMs) {
        return { key: hashedKey, failedCount: 0 };
      }

      return { key: hashedKey, failedCount: Number(data?.failedCount || 0) };
    }
  } catch (err: any) {
    if (err instanceof ApiError && err.statusCode === 429) throw err;
    // Non-fatal if firestore is unreachable
  }

  return { key: hashedKey, failedCount: mem ? mem.failedCount : 0 };
}

/**
 * Record a failed authentication attempt with concurrency-safe increment
 */
export async function recordFailedAttempt(
  rawIdentifier: string,
  limit: number = 5,
  lockoutMs: number = 5 * 60 * 1000
): Promise<{ failedCount: number; isLocked: boolean; remainingSeconds: number }> {
  const hashedKey = `rl_${hashKeyComponent(rawIdentifier)}`;
  const now = Date.now();

  // In-memory tracking
  let memCount = 1;
  const mem = memoryLimiter.get(hashedKey);
  if (mem && (now - mem.lastFailedAt <= lockoutMs)) {
    memCount = mem.failedCount + 1;
  }
  const isMemLocked = memCount >= limit;
  const memLockedUntil = isMemLocked ? now + lockoutMs : 0;
  memoryLimiter.set(hashedKey, {
    failedCount: isMemLocked ? 0 : memCount,
    lockedUntil: memLockedUntil,
    lastFailedAt: now
  });

  try {
    const db = getDb();
    const docRef = db.collection('loginAttempts').doc(hashedKey);

    let newCount = 1;
    let isLocked = false;
    let lockedUntil = 0;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (snap.exists) {
        const data = snap.data() || {};
        const lastFailedAt = Number(data.lastFailedAt || 0);

        if (now - lastFailedAt > lockoutMs) {
          newCount = 1;
        } else {
          newCount = Number(data.failedCount || 0) + 1;
        }
      } else {
        newCount = 1;
      }

      isLocked = newCount >= limit;
      lockedUntil = isLocked ? now + lockoutMs : 0;

      transaction.set(
        docRef,
        {
          key: hashedKey,
          failedCount: newCount,
          isLocked,
          lockedUntil,
          lastFailedAt: now
        },
        { merge: true }
      );
    });

    const remainingSeconds = isLocked ? Math.ceil(lockoutMs / 1000) : 0;
    return { failedCount: newCount, isLocked, remainingSeconds };
  } catch (err) {
    // If firestore fails, return in-memory result
    const remainingSeconds = isMemLocked ? Math.ceil(lockoutMs / 1000) : 0;
    return { failedCount: memCount, isLocked: isMemLocked, remainingSeconds };
  }
}

/**
 * Clear failed attempts on successful login.
 * ONLY writes if there was a previous failure, saving quota on normal logins.
 */
export async function clearFailedAttempts(rawIdentifier: string): Promise<void> {
  const hashedKey = `rl_${hashKeyComponent(rawIdentifier)}`;
  memoryLimiter.delete(hashedKey);
  burstShield.delete(hashedKey);

  try {
    const db = getDb();
    const docRef = db.collection('loginAttempts').doc(hashedKey);
    const snap = await docRef.get();
    if (snap.exists) {
      await docRef.delete();
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Comprehensive dual-layer rate check: Account + IP
 */
export async function enforceAuthRateLimit(
  req: VercelApiRequest,
  accountIdentifier: string
): Promise<{ accountKey: string; ipKey: string }> {
  const clientIp = getClientIp(req);

  // 1. Check IP rate limit (20 failed attempts / 5 mins for IP)
  await checkRateLimit(`ip_${clientIp}`, 20, 5 * 60 * 1000);

  // 2. Check Account rate limit (5 failed attempts / 5 mins for this account)
  await checkRateLimit(`acc_${accountIdentifier}`, 5, 5 * 60 * 1000);

  return {
    accountKey: `acc_${accountIdentifier}`,
    ipKey: `ip_${clientIp}`
  };
}

/**
 * Record failure on both Account and IP
 */
export async function recordAuthFailure(
  accountKey: string,
  ipKey: string
): Promise<void> {
  await Promise.allSettled([
    recordFailedAttempt(accountKey, 5, 5 * 60 * 1000),
    recordFailedAttempt(ipKey, 20, 5 * 60 * 1000)
  ]);
}

/**
 * Clear successful attempt on both Account and IP
 */
export async function clearAuthSuccess(
  accountKey: string,
  ipKey: string
): Promise<void> {
  await Promise.allSettled([
    clearFailedAttempts(accountKey),
    clearFailedAttempts(ipKey)
  ]);
}
