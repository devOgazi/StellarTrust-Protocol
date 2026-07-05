/**
 * Registry API Routes
 *
 * Implements the registry endpoints from the README "Key API Endpoints":
 *
 *   GET /api/v1/registry/issuers   — List trusted issuers
 *   GET /api/v1/registry/schemas   — List credential schemas
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { readRateLimit } from '../middleware/ratelimit';

// ---------------------------------------------------------------------------
// Static credential schemas
// These mirror the CredentialType enum from contracts/shared/src/types.rs
// ---------------------------------------------------------------------------

const CREDENTIAL_SCHEMAS = [
  {
    id: 'schema:KYCBasic',
    type: 'KYCBasic',
    name: 'KYC Basic',
    description: 'Basic identity verification (email + phone)',
    properties: ['firstName', 'lastName', 'email', 'phone'],
    issuerScopeRequired: 'KYCBasic',
  },
  {
    id: 'schema:KYCVerified',
    type: 'KYCVerified',
    name: 'KYC Verified',
    description: 'Full government-ID verified KYC (Tier 2)',
    properties: ['firstName', 'lastName', 'dateOfBirth', 'nationality', 'documentType', 'documentNumber'],
    issuerScopeRequired: 'KYCVerified',
  },
  {
    id: 'schema:ProofOfAddress',
    type: 'ProofOfAddress',
    name: 'Proof of Address',
    description: 'Verified residential address',
    properties: ['address', 'city', 'country', 'postalCode', 'verifiedAt'],
    issuerScopeRequired: 'ProofOfAddress',
  },
  {
    id: 'schema:EmploymentVerification',
    type: 'EmploymentVerification',
    name: 'Employment Verification',
    description: 'Current employment status verification',
    properties: ['employer', 'jobTitle', 'startDate', 'employmentType'],
    issuerScopeRequired: 'EmploymentVerification',
  },
  {
    id: 'schema:IncomeVerification',
    type: 'IncomeVerification',
    name: 'Income Verification',
    description: 'Monthly income range verification',
    properties: ['incomeRange', 'currency', 'period'],
    issuerScopeRequired: 'IncomeVerification',
  },
  {
    id: 'schema:EducationCertificate',
    type: 'EducationCertificate',
    name: 'Education Certificate',
    description: 'Academic qualification credential',
    properties: ['institution', 'degree', 'field', 'graduationYear'],
    issuerScopeRequired: 'EducationCertificate',
  },
  {
    id: 'schema:BusinessRegistration',
    type: 'BusinessRegistration',
    name: 'Business Registration',
    description: 'Legal business entity registration',
    properties: ['businessName', 'registrationNumber', 'country', 'registeredAt'],
    issuerScopeRequired: 'BusinessRegistration',
  },
];

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createRegistryRouter(prisma: PrismaClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // GET /api/v1/registry/issuers  — List trusted issuers
  // -------------------------------------------------------------------------
  router.get(
    '/issuers',
    readRateLimit,
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const issuers = await prisma.issuer.findMany({
          where: { active: true },
          orderBy: { registeredAt: 'asc' },
          select: {
            id: true,
            address: true,
            name: true,
            url: true,
            credentialTypes: true,
            registeredAt: true,
          },
        });

        res.json({
          issuers: issuers.map((i) => ({
            id: i.id,
            address: i.address,
            did: `did:stellar:${i.address}`,
            name: i.name,
            url: i.url,
            credentialTypes: i.credentialTypes,
            registeredAt: i.registeredAt.toISOString(),
          })),
          total: issuers.length,
        });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/registry/schemas  — List credential schemas
  // -------------------------------------------------------------------------
  router.get(
    '/schemas',
    readRateLimit,
    async (_req: Request, res: Response): Promise<void> => {
      res.json({
        schemas: CREDENTIAL_SCHEMAS,
        total: CREDENTIAL_SCHEMAS.length,
      });
    },
  );

  return router;
}
