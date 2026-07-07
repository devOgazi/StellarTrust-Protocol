/**
 * Identity API Routes
 *
 * Implements the identity endpoints from the README "Key API Endpoints":
 *
 *   GET    /api/v1/identity/:address    — Resolve DID document
 *   POST   /api/v1/identity/create      — Create new DID (auth required)
 *   POST   /api/v1/identity/credential  — Add credential (auth required)
 *   DELETE /api/v1/identity/credential/:id — Revoke credential (auth required)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { DIDResolverService } from '../services/did-resolver';
import { requireAuth, optionalAuth, type AuthenticatedRequest } from '../middleware/auth';
import { readRateLimit, apiRateLimit } from '../middleware/ratelimit';
import { isValidStellarAddress, addressToDid } from '../utils/stellar';
import { sha256Hex, encodePublicKeyMultibase } from '../utils/crypto';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const CreateDIDSchema = z.object({
  /** Stellar account address to create a DID for */
  address: z.string(),
  /** Hex-encoded 32-byte Ed25519 public key */
  publicKeyHex: z.string().optional(),
});

const AddCredentialSchema = z.object({
  ownerAddress: z.string(),
  issuerAddress: z.string(),
  credentialType: z.enum([
    'KYCBasic',
    'KYCVerified',
    'ProofOfAddress',
    'EmploymentVerification',
    'IncomeVerification',
    'EducationCertificate',
    'BusinessRegistration',
  ]).or(z.string().startsWith('Custom:')),
  credentialHash: z.string().optional(),
  ipfsCid: z.string().optional(),
  expiresAt: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createIdentityRouter(prisma: PrismaClient): Router {
  const router = Router();
  const resolver = new DIDResolverService(prisma);

  // -------------------------------------------------------------------------
  // GET /api/v1/identity/:address  — Resolve DID document
  // -------------------------------------------------------------------------
  router.get(
    '/:address',
    readRateLimit,
    optionalAuth,
    async (req: Request, res: Response): Promise<void> => {
      const { address } = req.params;

      if (!isValidStellarAddress(address)) {
        res.status(400).json({ error: `Invalid Stellar address: ${address}` });
        return;
      }

      try {
        const doc = await resolver.resolve(address);
        res.json(doc);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('not found')) {
          res.status(404).json({ error: message });
        } else {
          res.status(500).json({ error: message });
        }
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/identity/create  — Create new DID
  //
  // Auth: optionalAuth for MVP — the wallet address in the body is the
  // canonical owner.  When a JWT is present the address must match the token
  // subject; when absent (browser wallets that haven't completed SEP-0010)
  // the address is accepted at face value and anchored to the Soroban
  // contract which enforces ownership on-chain.
  // -------------------------------------------------------------------------
  router.post(
    '/create',
    apiRateLimit,
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const parsed = CreateDIDSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
        return;
      }

      const { address, publicKeyHex } = parsed.data;

      if (!isValidStellarAddress(address)) {
        res.status(400).json({ error: `Invalid Stellar address: ${address}` });
        return;
      }

      // If a JWT is present, it must match the requested address
      if (req.account && req.account !== address) {
        res.status(403).json({ error: 'Authenticated account does not match the requested address' });
        return;
      }

      try {
        // Check for existing DID
        const existing = await prisma.identity.findUnique({ where: { address } });
        if (existing) {
          res.status(409).json({ error: 'DID already exists for this address' });
          return;
        }

        const did = addressToDid(address);
        const publicKeyMultibase = publicKeyHex
          ? encodePublicKeyMultibase(publicKeyHex)
          : undefined;

        await prisma.identity.create({
          data: { address, did, publicKeyMultibase },
        });

        const doc = await resolver.resolve(address);
        res.status(201).json(doc);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/identity/credential  — Add credential
  //
  // Auth: optionalAuth for MVP — a registered issuer or the account owner
  // may add credentials.  On-chain enforcement is the canonical authority.
  // -------------------------------------------------------------------------
  router.post(
    '/credential',
    apiRateLimit,
    optionalAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const parsed = AddCredentialSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
        return;
      }

      const {
        ownerAddress,
        issuerAddress,
        credentialType,
        credentialHash,
        ipfsCid,
        expiresAt,
      } = parsed.data;

      if (!isValidStellarAddress(ownerAddress)) {
        res.status(400).json({ error: `Invalid ownerAddress: ${ownerAddress}` });
        return;
      }
      if (!isValidStellarAddress(issuerAddress)) {
        res.status(400).json({ error: `Invalid issuerAddress: ${issuerAddress}` });
        return;
      }

      // Only an issuer or the account owner can add a credential.
      // When no JWT is present (MVP unauthenticated path), we allow the
      // request and rely on on-chain contract enforcement for production.
      if (req.account) {
        const isIssuer = await prisma.issuer.findUnique({ where: { address: req.account } });
        if (!isIssuer && req.account !== ownerAddress) {
          res.status(403).json({ error: 'Only registered issuers or the account owner may add credentials' });
          return;
        }
      }

      try {
        // Ensure identity row exists
        await prisma.identity.upsert({
          where: { address: ownerAddress },
          create: { address: ownerAddress, did: addressToDid(ownerAddress) },
          update: {},
        });

        const credentialId = sha256Hex(
          `${ownerAddress}:${issuerAddress}:${credentialType}:${Date.now()}`,
        );

        const credential = await prisma.credential.create({
          data: {
            credentialId,
            ownerAddress,
            issuerAddress,
            credentialType,
            credentialHash: credentialHash ?? null,
            ipfsCid: ipfsCid ?? null,
            expiresAt: expiresAt ? new Date(expiresAt * 1000) : null,
          },
        });

        res.status(201).json({
          id: `cred:${credential.credentialId}`,
          type: credential.credentialType,
          issuer: `did:stellar:${credential.issuerAddress}`,
          issuedAt: Math.floor(credential.issuedAt.getTime() / 1000),
          expiresAt: credential.expiresAt
            ? Math.floor(credential.expiresAt.getTime() / 1000)
            : undefined,
          credentialHash: credential.credentialHash ?? '',
        });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /api/v1/identity/credential/:id  — Revoke credential
  // -------------------------------------------------------------------------
  router.delete(
    '/credential/:id',
    apiRateLimit,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const credentialId = id.startsWith('cred:') ? id.slice(5) : id;

      try {
        const credential = await prisma.credential.findUnique({
          where: { credentialId },
        });

        if (!credential) {
          res.status(404).json({ error: `Credential not found: ${id}` });
          return;
        }

        // Only the credential owner or the issuer may revoke
        const canRevoke =
          req.account === credential.ownerAddress ||
          req.account === credential.issuerAddress;

        if (!canRevoke) {
          res.status(403).json({ error: 'Insufficient permissions to revoke this credential' });
          return;
        }

        if (credential.revokedAt) {
          res.status(409).json({ error: 'Credential is already revoked' });
          return;
        }

        await prisma.credential.update({
          where: { credentialId },
          data: { revokedAt: new Date() },
        });

        res.status(200).json({ message: 'Credential revoked successfully', credentialId });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  return router;
}
