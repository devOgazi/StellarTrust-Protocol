/**
 * Credentials API Routes
 *
 * Credential management is handled via the identity router.
 * This file exports additional helpers and the attest endpoint.
 *
 *   POST /api/v1/attest  — Issue attestation (issuers only)
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AttestationService } from '../services/attestation';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { attestRateLimit } from '../middleware/ratelimit';

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const AttestSchema = z.object({
  subjectAddress: z.string(),
  claimKey: z.string().min(1),
  /** Base64-encoded claim value */
  claimValue: z.string().min(1),
  /** Optional expiry Unix timestamp (seconds) */
  expiresAt: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createAttestRouter(prisma: PrismaClient): Router {
  const router = Router();
  const attestation = new AttestationService(prisma);

  // -------------------------------------------------------------------------
  // POST /api/v1/attest  — Issue attestation (registered issuers only)
  // -------------------------------------------------------------------------
  router.post(
    '/',
    attestRateLimit,
    requireAuth,
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const parsed = AttestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
        return;
      }

      try {
        const result = await attestation.attest({
          issuerAddress: req.account!,
          ...parsed.data,
        });
        res.status(201).json(result);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('not a registered trusted issuer')) {
          res.status(403).json({ error: message });
        } else {
          res.status(500).json({ error: message });
        }
      }
    },
  );

  return router;
}
