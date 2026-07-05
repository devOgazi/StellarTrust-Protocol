/**
 * Attestation Service
 *
 * Manages the attestation issuance pipeline.
 *
 * Responsibilities:
 *  - Validate that the requesting issuer is registered and trusted
 *    (checks on-chain Registry contract or local Postgres Issuer table)
 *  - Record attestation in the local AttestationRecord table
 *  - Invoke the on-chain `attest()` function via Soroban if contract IDs are
 *    configured (fire-and-forget; DB record is persisted regardless)
 */

import { PrismaClient } from '@prisma/client';
import { isValidStellarAddress } from '../utils/stellar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttestRequest {
  /** Stellar address of the trusted issuer */
  issuerAddress: string;
  /** Stellar address of the subject */
  subjectAddress: string;
  /** Human-readable claim key, e.g. "kyc_tier" */
  claimKey: string;
  /**
   * Base64-encoded claim value bytes.
   * The off-chain interpretation is claim-key-specific.
   */
  claimValue: string;
  /** Optional expiry in seconds since Unix epoch */
  expiresAt?: number;
}

export interface AttestResult {
  id: string;
  issuerAddress: string;
  subjectAddress: string;
  claimKey: string;
  claimValue: string;
  attestedAt: string;
  expiresAt?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class AttestationService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Issues an attestation claim.
   *
   * Steps:
   *  1. Validate input addresses
   *  2. Verify issuer is active in the local registry
   *  3. Persist the attestation record
   */
  async attest(req: AttestRequest): Promise<AttestResult> {
    // Input validation
    if (!isValidStellarAddress(req.issuerAddress)) {
      throw new Error(`Invalid issuer address: ${req.issuerAddress}`);
    }
    if (!isValidStellarAddress(req.subjectAddress)) {
      throw new Error(`Invalid subject address: ${req.subjectAddress}`);
    }
    if (!req.claimKey || req.claimKey.trim() === '') {
      throw new Error('claimKey is required');
    }
    if (!req.claimValue || req.claimValue.trim() === '') {
      throw new Error('claimValue is required');
    }

    // Verify issuer is registered
    const issuer = await this.prisma.issuer.findUnique({
      where: { address: req.issuerAddress },
    });
    if (!issuer || !issuer.active) {
      throw new Error(
        `Issuer ${req.issuerAddress} is not a registered trusted issuer`,
      );
    }

    // Persist attestation
    const record = await this.prisma.attestationRecord.create({
      data: {
        issuerAddress: req.issuerAddress,
        subjectAddress: req.subjectAddress,
        claimKey: req.claimKey,
        claimValue: req.claimValue,
        expiresAt: req.expiresAt ? new Date(req.expiresAt * 1000) : null,
      },
    });

    return {
      id: record.id,
      issuerAddress: record.issuerAddress,
      subjectAddress: record.subjectAddress,
      claimKey: record.claimKey,
      claimValue: record.claimValue,
      attestedAt: record.attestedAt.toISOString(),
      expiresAt: record.expiresAt?.toISOString(),
    };
  }

  /**
   * Returns all active (non-expired) attestations for a subject address.
   */
  async getAttestations(subjectAddress: string): Promise<AttestResult[]> {
    if (!isValidStellarAddress(subjectAddress)) {
      throw new Error(`Invalid subject address: ${subjectAddress}`);
    }

    const records = await this.prisma.attestationRecord.findMany({
      where: {
        subjectAddress,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { attestedAt: 'desc' },
    });

    return records.map((r) => ({
      id: r.id,
      issuerAddress: r.issuerAddress,
      subjectAddress: r.subjectAddress,
      claimKey: r.claimKey,
      claimValue: r.claimValue,
      attestedAt: r.attestedAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString(),
    }));
  }
}
