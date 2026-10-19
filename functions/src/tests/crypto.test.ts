import assert from 'node:assert';
import test from 'node:test';
import {
  generateAccessCode,
  generateClassCode,
  generateSalt,
  hashAccessCode,
  verifyAccessCode
} from '../utils/crypto';

test('Crypto: should generate 6-character random access code', () => {
  const code = generateAccessCode(6);
  assert.strictEqual(code.length, 6);
  assert.match(code, /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
});

test('Crypto: should generate 6-character class code', () => {
  const code = generateClassCode(6);
  assert.strictEqual(code.length, 6);
});

test('Crypto: should correctly hash and verify access code with salt', () => {
  const salt = generateSalt();
  const rawCode = 'ABC234';
  const hashed = hashAccessCode(rawCode, salt);

  assert.strictEqual(verifyAccessCode('ABC234', salt, hashed), true);
  assert.strictEqual(verifyAccessCode('abc234', salt, hashed), true); // Case-insensitive
  assert.strictEqual(verifyAccessCode('WRONG1', salt, hashed), false);
});
