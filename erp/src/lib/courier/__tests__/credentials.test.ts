import { randomBytes } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CourierCredentialError,
  decryptCourierAccount,
  decryptCourierSecret,
  encryptCourierSecret,
  isCourierCredentialKeyConfigured,
  isEncryptedCourierSecret,
} from '@/lib/courier/credentials';

/**
 * ARGUS #514 — courier secrets are stored as AES-256-GCM ciphertext. Test
 * secrets are generated at runtime so no credential-shaped literal is committed.
 */
const ENV_KEYS = ['COURIER_CREDENTIALS_KEY', 'AUTH_SECRET', 'NEXTAUTH_SECRET'] as const;
const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearKeyEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

beforeEach(() => {
  clearKeyEnv();
  process.env.COURIER_CREDENTIALS_KEY = randomBytes(32).toString('hex');
});

afterAll(restoreEnv);

describe('encryptCourierSecret / decryptCourierSecret', () => {
  it('round-trips a secret without storing it in clear text', () => {
    const secret = randomBytes(18).toString('base64');
    const stored = encryptCourierSecret(secret);

    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(stored).not.toContain(secret);
    expect(isEncryptedCourierSecret(stored)).toBe(true);
    expect(decryptCourierSecret(stored)).toBe(secret);
  });

  it('uses a fresh IV so the same secret encrypts differently each time', () => {
    const secret = randomBytes(18).toString('base64');
    expect(encryptCourierSecret(secret)).not.toBe(encryptCourierSecret(secret));
  });

  it('leaves already-encrypted values unchanged', () => {
    const stored = encryptCourierSecret(randomBytes(18).toString('base64'));
    expect(encryptCourierSecret(stored)).toBe(stored);
  });

  it('passes legacy plaintext through on read', () => {
    const legacy = randomBytes(18).toString('base64');
    expect(isEncryptedCourierSecret(legacy)).toBe(false);
    expect(decryptCourierSecret(legacy)).toBe(legacy);
  });

  it('rejects tampered ciphertext instead of returning garbage', () => {
    const stored = encryptCourierSecret(randomBytes(18).toString('base64'));
    const tampered = `${stored.slice(0, -2)}AA`;
    expect(() => decryptCourierSecret(tampered)).toThrow(CourierCredentialError);
  });

  it('fails closed on write when no key material is configured', () => {
    clearKeyEnv();
    expect(isCourierCredentialKeyConfigured()).toBe(false);
    expect(() => encryptCourierSecret(randomBytes(18).toString('base64'))).toThrowError(
      /not configured/,
    );
  });

  it('refuses to decrypt ciphertext when the key is missing', () => {
    const stored = encryptCourierSecret(randomBytes(18).toString('base64'));
    clearKeyEnv();
    expect(() => decryptCourierSecret(stored)).toThrow(CourierCredentialError);
  });
});

describe('decryptCourierAccount', () => {
  it('decrypts password and API key for outbound auth only', () => {
    const password = randomBytes(18).toString('base64');
    const apiKey = randomBytes(18).toString('base64');
    const account = {
      id: 'courier-1',
      email: 'operator@example.com',
      password: encryptCourierSecret(password),
      apiKey: encryptCourierSecret(apiKey),
    };

    const decrypted = decryptCourierAccount(account);
    expect(decrypted.password).toBe(password);
    expect(decrypted.apiKey).toBe(apiKey);
    expect(decrypted.email).toBe(account.email);
    // The original row object is untouched.
    expect(account.password).not.toBe(password);
  });
});
