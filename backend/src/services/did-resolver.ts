/**
 * DID Resolver Service
 *
 * Resolves `did:stellar:<address>` to a W3C-conformant DID Document by:
 *   1. Querying the StellarTrust Identity contract via Soroban RPC
 *   2. Falling back to the local Postgres Identity/Credential records when
 *      the on-chain call fails (e.g. testnet connectivity issues)
 *
 * The returned JSON shape exactly matches the DID Document Structure example
 * from the README.
 */

import { PrismaClient } from '@prisma/client';
import {
  getSorobanRpc,
  addressToDid,
  isValidStellarAddress,
  simulateContractCall,
  addressToScVal,
  scValToNative,
} from '../utils/stellar';
import { encodePublicKeyMultibase } from '../utils/crypto';

// ---------------------------------------------------------------------------
// Types matching the README DID Document Structure
// ---------------------------------------------------------------------------

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase: string;
}

export interface DIDServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

export interface CredentialRef {
  id: string;
  type: string;
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  credentialHash: string;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller: string;
  verificationMethod: VerificationMethod[];
  authentication: string[];
  service: DIDServiceEndpoint[];
  credentials: CredentialRef[];
}

// Raw shape returned by the Soroban contract (native-decoded)
interface OnChainDIDDocument {
  did: string;
  controller: string;
  verification_methods: Array<{
    id: string;
    key_type: string;
    controller: string;
    public_key: Buffer | Uint8Array;
  }>;
  credentials: Array<{
    id: Buffer | Uint8Array;
    credential_type: unknown;
    issuer: string;
    issued_at: bigint;
    expires_at?: bigint;
    credential_hash: Buffer | Uint8Array;
  }>;
  created_at: bigint;
  updated_at: bigint;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class DIDResolverService {
  private readonly prisma: PrismaClient;
  private readonly identityContractId: string;
  private readonly apiBaseUrl: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.identityContractId = process.env.IDENTITY_CONTRACT_ID ?? '';
    this.apiBaseUrl = `https://api.stellartrust.io`;
  }

  /**
   * Resolves a Stellar address or a `did:stellar:<address>` string to a
   * full W3C DID Document.
   *
   * Resolution order:
   *   1. Soroban RPC → on-chain source of truth
   *   2. Local Postgres cache (fallback when chain is unreachable)
   */
  async resolve(addressOrDid: string): Promise<DIDDocument> {
    // Normalise to address
    const address = addressOrDid.startsWith('did:stellar:')
      ? addressOrDid.slice('did:stellar:'.length)
      : addressOrDid;

    if (!isValidStellarAddress(address)) {
      throw new Error(`Invalid Stellar address: ${address}`);
    }

    // 1. Try on-chain resolution
    if (this.identityContractId && this.identityContractId !== 'C...') {
      try {
        return await this.resolveOnChain(address);
      } catch (err) {
        // Fall through to DB cache
        console.warn(`[DIDResolver] On-chain resolution failed, using DB cache: ${(err as Error).message}`);
      }
    }

    // 2. Fallback to Postgres
    return this.resolveFromDB(address);
  }

  // ---------- private helpers ----------------------------------------------

  private async resolveOnChain(address: string): Promise<DIDDocument> {
    const raw = await simulateContractCall<OnChainDIDDocument>({
      contractId: this.identityContractId,
      method: 'resolve_did',
      args: [addressToScVal(address)],
      // We need any funded account for fee simulation; re-use the subject
      sourceAccount: address,
    });

    return this.mapOnChainDoc(address, raw);
  }

  private mapOnChainDoc(address: string, raw: OnChainDIDDocument): DIDDocument {
    const did = addressToDid(address);

    const verificationMethods: VerificationMethod[] = (
      raw.verification_methods ?? []
    ).map((vm) => {
      const pkHex = Buffer.from(vm.public_key).toString('hex');
      return {
        id: `${did}#primary`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyMultibase: encodePublicKeyMultibase(pkHex),
      };
    });

    const credentials: CredentialRef[] = (raw.credentials ?? []).map((c) => ({
      id: `cred:0x${Buffer.from(c.id).toString('hex')}`,
      type: credentialTypeToString(c.credential_type),
      issuer: c.issuer,
      issuedAt: Number(c.issued_at),
      expiresAt: c.expires_at ? Number(c.expires_at) : undefined,
      credentialHash: `0x${Buffer.from(c.credential_hash).toString('hex')}`,
    }));

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://stellartrust.io/contexts/v1',
      ],
      id: did,
      controller: did,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map((vm) => vm.id),
      service: [
        {
          id: `${did}#credit-score`,
          type: 'CreditScoreService',
          serviceEndpoint: `${this.apiBaseUrl}/score/${address}`,
        },
      ],
      credentials,
    };
  }

  private async resolveFromDB(address: string): Promise<DIDDocument> {
    const identity = await this.prisma.identity.findUnique({
      where: { address },
      include: {
        credentials: {
          where: { revokedAt: null },
        },
      },
    });

    if (!identity) {
      throw new Error(`DID not found for address: ${address}`);
    }

    const did = identity.did;
    const vmId = `${did}#primary`;

    const verificationMethods: VerificationMethod[] = identity.publicKeyMultibase
      ? [
          {
            id: vmId,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: identity.publicKeyMultibase,
          },
        ]
      : [];

    const credentials: CredentialRef[] = identity.credentials.map((c) => ({
      id: `cred:${c.credentialId}`,
      type: c.credentialType,
      issuer: `did:stellar:${c.issuerAddress}`,
      issuedAt: Math.floor(c.issuedAt.getTime() / 1000),
      expiresAt: c.expiresAt
        ? Math.floor(c.expiresAt.getTime() / 1000)
        : undefined,
      credentialHash: c.credentialHash ?? '',
    }));

    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://stellartrust.io/contexts/v1',
      ],
      id: did,
      controller: did,
      verificationMethod: verificationMethods,
      authentication: verificationMethods.map((vm) => vm.id),
      service: [
        {
          id: `${did}#credit-score`,
          type: 'CreditScoreService',
          serviceEndpoint: `${this.apiBaseUrl}/score/${address}`,
        },
      ],
      credentials,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps the raw Soroban-decoded CredentialType enum to a string. */
function credentialTypeToString(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    const key = Object.keys(raw as object)[0];
    if (key === 'Custom') {
      return `Custom:${(raw as Record<string, string>).Custom}`;
    }
    return key;
  }
  return 'Unknown';
}
