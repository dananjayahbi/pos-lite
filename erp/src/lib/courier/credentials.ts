/**
 * ARGUS #514 — courier credential encryption seam.
 *
 * `CourierAccount.password` / `.apiKey` were stored as plaintext, so a database
 * read or backup exposed the live Trans Express password. The existing String
 * columns fit a prefixed ciphertext, so no migration is required.
 *
 * Format: `enc:v1:<iv b64url>.<tag b64url>.<ciphertext b64url>` (AES-256-GCM).
 * Values without the prefix are legacy plaintext: reads pass them through so an
 * existing account keeps working, and any subsequent save re-encrypts them.
 *
 * Key material: `COURIER_CREDENTIALS_KEY` when set, otherwise `AUTH_SECRET` /
 * `NEXTAUTH_SECRET` so deployments need no new mandatory env var. A dedicated
 * key is still recommended (rotating AUTH_SECRET remints courier ciphertext).
 *
 * Fail closed: a new secret is never written in clear text when no key material
 * is configured — the write is rejected instead.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export type CourierCredentialErrorCode =
  | 'ENCRYPTION_KEY_MISSING'
  | 'MALFORMED_CIPHERTEXT'
  | 'DECRYPT_FAILED';

export class CourierCredentialError extends Error {
  readonly code: CourierCredentialErrorCode;

  constructor(code: CourierCredentialErrorCode, message: string) {
    super(message);
    this.name = 'CourierCredentialError';
    this.code = code;
  }
}

function keyMaterial(): string | null {
  for (const candidate of [
    process.env.COURIER_CREDENTIALS_KEY,
    process.env.AUTH_SECRET,
    process.env.NEXTAUTH_SECRET,
  ]) {
    if (candidate && candidate.trim() !== '') return candidate;
  }
  return null;
}

/** Whether a key is available (used to migrate legacy plaintext lazily). */
export function isCourierCredentialKeyConfigured(): boolean {
  return keyMaterial() !== null;
}

function encryptionKey(): Buffer {
  const material = keyMaterial();
  if (!material) {
    throw new CourierCredentialError(
      'ENCRYPTION_KEY_MISSING',
      'Courier credential encryption is not configured (set COURIER_CREDENTIALS_KEY or AUTH_SECRET)',
    );
  }
  // Fixed, domain-separated derivation so the raw env secret is never used as
  // the AES key directly.
  return createHash('sha256')
    .update(`argus:courier-credentials:v1:${material}`)
    .digest();
}

export function isEncryptedCourierSecret(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypt one secret for storage. Never falls back to plaintext. */
export function encryptCourierSecret(plaintext: string): string {
  if (isEncryptedCourierSecret(plaintext)) return plaintext;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

/**
 * Decrypt a stored secret. Legacy plaintext is returned unchanged; a broken
 * ciphertext throws rather than being handed to the courier as a credential.
 */
export function decryptCourierSecret(value: string): string {
  if (!isEncryptedCourierSecret(value)) return value;

  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 3) {
    throw new CourierCredentialError(
      'MALFORMED_CIPHERTEXT',
      'Saved courier credential is malformed',
    );
  }

  try {
    const [ivPart, tagPart, ciphertextPart] = parts as [string, string, string];
    const decipher = createDecipheriv(
      ALGORITHM,
      encryptionKey(),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof CourierCredentialError) throw error;
    throw new CourierCredentialError(
      'DECRYPT_FAILED',
      'Saved courier credential could not be decrypted',
    );
  }
}

interface StoredCourierAccount {
  password?: string | null;
  apiKey?: string | null;
}

/**
 * Return a copy of a stored account with its secrets decrypted. Callers pass
 * this to adapters; the database row stays ciphertext.
 */
export function decryptCourierAccount<T extends StoredCourierAccount>(
  account: T,
): T {
  return {
    ...account,
    password: account.password ? decryptCourierSecret(account.password) : account.password,
    apiKey: account.apiKey ? decryptCourierSecret(account.apiKey) : account.apiKey,
  };
}
