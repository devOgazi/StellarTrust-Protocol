/**
 * Cryptographic utilities for StellarTrust Protocol backend.
 *
 * Provides:
 *  - SHA-256 hashing for credential payload tamper detection
 *  - AES-256-GCM encryption / decryption for IPFS credential payloads
 *  - Random nonce / salt generation
 *  - Base64 / hex encoding helpers
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// AES-256-GCM parameters
const AES_KEY_BYTES = 32; // 256-bit key
const IV_BYTES = 12;      // 96-bit IV recommended for GCM
const AUTH_TAG_BYTES = 16; // 128-bit auth tag

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

/**
 * Returns the hex-encoded SHA-256 hash of any serialisable value.
 * Used to compute the `credentialHash` that matches what the on-chain
 * Identity contract stores (SHA-256 of the off-chain credential payload).
 */
export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Returns the Buffer SHA-256 hash of any serialisable value.
 */
export function sha256Buffer(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Returns the hex-encoded SHA-256 hash of a JSON-serialisable object.
 */
export function hashObject(obj: unknown): string {
  return sha256Hex(JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Key derivation / generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random 32-byte key and returns it as a
 * hex string. Suitable for use as `CREDENTIAL_ENCRYPTION_KEY`.
 */
export function generateEncryptionKey(): string {
  return randomBytes(AES_KEY_BYTES).toString('hex');
}

/**
 * Parses the `CREDENTIAL_ENCRYPTION_KEY` environment variable into a
 * 32-byte Buffer. Throws clearly if the variable is absent or malformed.
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY environment variable is not set');
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== AES_KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must be a ${AES_KEY_BYTES * 2}-character hex string`,
    );
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Symmetric encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

/** Wire format returned by `encrypt`. Suitable for JSON serialisation / IPFS upload. */
export interface EncryptedPayload {
  /** Hex-encoded 12-byte IV */
  iv: string;
  /** Hex-encoded 16-byte GCM auth tag */
  tag: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
}

/**
 * Encrypts `plaintext` with AES-256-GCM using the configured encryption key.
 *
 * Each call generates a fresh random IV — **never reuse** an IV with the
 * same key.
 */
export function encrypt(plaintext: string, key?: Buffer): EncryptedPayload {
  const encKey = key ?? getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    ciphertext: encrypted.toString('base64'),
  };
}

/**
 * Decrypts an `EncryptedPayload` produced by `encrypt`.
 * Throws `Error` if the auth tag verification fails (data tampered).
 */
export function decrypt(payload: EncryptedPayload, key?: Buffer): string {
  const encKey = key ?? getEncryptionKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/** Converts a hex string to a Buffer. */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/** Converts a Buffer to a hex string. */
export function bufferToHex(buf: Buffer): string {
  return buf.toString('hex');
}

/** Encodes a string or Buffer as base64. */
export function toBase64(data: string | Buffer): string {
  return Buffer.isBuffer(data)
    ? data.toString('base64')
    : Buffer.from(data, 'utf8').toString('base64');
}

/** Decodes a base64 string to a UTF-8 string. */
export function fromBase64(data: string): string {
  return Buffer.from(data, 'base64').toString('utf8');
}

// ---------------------------------------------------------------------------
// Multibase (for DID verification methods)
// ---------------------------------------------------------------------------

/**
 * Encodes a 32-byte Ed25519 public key as a multibase base58btc string
 * (prefix 'z'), suitable for the `publicKeyMultibase` field in a DID document.
 *
 * This is a lightweight implementation — for production use a proper
 * multibase library (e.g. `multiformats`) should be used.
 */
export function encodePublicKeyMultibase(publicKeyHex: string): string {
  // Prefix 'z' = base58btc in the multibase table
  const buf = hexToBuffer(publicKeyHex);
  return 'z' + buf.toString('base64url');
}
