/**
 * IPFS Service
 *
 * Stores and retrieves encrypted credential payloads on IPFS.
 * Payloads are encrypted with AES-256-GCM before upload so that:
 *   - Only the holder (who knows the key) can decrypt and present
 *   - IPFS nodes learn nothing about credential contents
 *
 * The service uses the ipfs-http-client library to communicate with
 * a local or remote IPFS daemon (Kubo).
 */

import { encrypt, decrypt, hashObject, sha256Hex, type EncryptedPayload } from '../utils/crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The envelope written to IPFS. Contains metadata + encrypted payload. */
export interface IPFSCredentialEnvelope {
  version: 1;
  /** SHA-256 of the plaintext credential JSON (matches on-chain credentialHash) */
  credentialHash: string;
  /** AES-256-GCM encrypted payload */
  encrypted: EncryptedPayload;
  /** RFC-3339 timestamp of upload */
  uploadedAt: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IPFSService {
  private client: unknown = null;
  private readonly gatewayUrl: string;
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = process.env.IPFS_API_URL ?? 'http://localhost:5001';
    this.gatewayUrl = process.env.IPFS_GATEWAY_URL ?? 'http://localhost:8080';
  }

  // ---------- Lazy init -------------------------------------------------------

  private async getClient(): Promise<unknown> {
    if (this.client) return this.client;

    try {
      // Dynamic import so that missing ipfs-http-client doesn't crash on startup
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { create } = require('ipfs-http-client') as {
        create: (opts: { url: string }) => unknown;
      };
      this.client = create({ url: this.apiUrl });
      return this.client;
    } catch {
      throw new Error(
        `ipfs-http-client not available or IPFS daemon unreachable at ${this.apiUrl}`,
      );
    }
  }

  // ---------- Public API --------------------------------------------------------

  /**
   * Encrypts `credentialPayload` and pins it to IPFS.
   *
   * @param credentialPayload  The raw (decrypted) credential JSON object
   * @param encryptionKey      Optional 32-byte key override; defaults to env var
   * @returns CID of the pinned envelope
   */
  async store(
    credentialPayload: Record<string, unknown>,
    encryptionKey?: Buffer,
  ): Promise<string> {
    const plaintext = JSON.stringify(credentialPayload);
    const credentialHash = sha256Hex(plaintext);
    const encrypted = encrypt(plaintext, encryptionKey);

    const envelope: IPFSCredentialEnvelope = {
      version: 1,
      credentialHash,
      encrypted,
      uploadedAt: new Date().toISOString(),
    };

    const envelopeJson = JSON.stringify(envelope);

    const ipfs = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (ipfs as any).add(envelopeJson, { pin: true });
    return result.cid.toString();
  }

  /**
   * Retrieves and decrypts the credential payload stored at `cid`.
   *
   * @param cid            IPFS CID returned by `store`
   * @param encryptionKey  Optional 32-byte key override
   * @returns The original plaintext credential JSON object
   */
  async retrieve(
    cid: string,
    encryptionKey?: Buffer,
  ): Promise<Record<string, unknown>> {
    const ipfs = await this.getClient();

    const chunks: Uint8Array[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const chunk of (ipfs as any).cat(cid)) {
      chunks.push(chunk as Uint8Array);
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    const envelope = JSON.parse(raw) as IPFSCredentialEnvelope;

    if (envelope.version !== 1) {
      throw new Error(`Unknown IPFS envelope version: ${envelope.version}`);
    }

    const plaintext = decrypt(envelope.encrypted, encryptionKey);
    return JSON.parse(plaintext) as Record<string, unknown>;
  }

  /**
   * Returns the public HTTP URL for a given CID via the configured gateway.
   * Does NOT require the IPFS daemon to be running.
   */
  gatewayUrlFor(cid: string): string {
    return `${this.gatewayUrl}/ipfs/${cid}`;
  }

  /**
   * Computes the SHA-256 credential hash of a payload object.
   * This is the value stored on-chain and inside the IPFS envelope.
   */
  computeCredentialHash(payload: Record<string, unknown>): string {
    return sha256Hex(JSON.stringify(payload));
  }

  /**
   * Verifies that a retrieved payload matches its stored hash.
   */
  verifyIntegrity(
    payload: Record<string, unknown>,
    expectedHash: string,
  ): boolean {
    return this.computeCredentialHash(payload) === expectedHash;
  }
}
