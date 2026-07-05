/**
 * Lender API Routes
 *
 * Implements the lender endpoint from the README "Key API Endpoints":
 *
 *   POST /api/v1/lender/verify  — Lender identity & score verification
 *
 * This endpoint is the primary integration point for the Lender SDK.
 * A lender provides:
 *   - The borrower's Stellar address
 *   - Minimum required credit score
 *   - Required credential types
 *
 * The response matches the SDK example in the README:
 *   { approved: true, score: 742, credentialsVerified: true }
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ScoreEngineService } from '../services/score-engine';
import { DIDResolverService } from '../services/did-resolver';
import { requireAuth } from '../middleware/auth';
import { lenderRateLimit } from '../middleware/ratelimit';
import { isValidStellarAddress } from '../utils/stellar';

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const LenderVerifySchema = z.object({
  /** Borrower's Stellar account address */
  address: z.string(),
  /** Minimum credit score required for approval */
  requiredScore: z.number().int().min(300).max(900).optional().default(0),
  /** Credential types that must all be present and active */
  requiredCredentials: z.array(z.string()).optional().default([]),
});

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createLenderRouter(prisma: PrismaClient): Router {
  const router = Router();
  const engine = new ScoreEngineService(prisma);
  const resolver = new DIDResolverService(prisma);

  // -------------------------------------------------------------------------
  // POST /api/v1/lender/verify  — Lender identity & score verification
  // -------------------------------------------------------------------------
  router.post(
    '/verify',
    lenderRateLimit,
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = LenderVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
        return;
      }

      const { address, requiredScore, requiredCredentials } = parsed.data;

      if (!isValidStellarAddress(address)) {
        res.status(400).json({ error: `Invalid Stellar address: ${address}` });
        return;
      }

      try {
        // Fetch score and DID document in parallel
        const [scoreResult, didDoc] = await Promise.allSettled([
          engine.getScore(address),
          resolver.resolve(address),
        ]);

        // Score check
        const hasScore = scoreResult.status === 'fulfilled';
        const score = hasScore ? scoreResult.value.score : null;
        const scoreApproved = score !== null && score >= requiredScore;

        // Credential check
        let credentialsVerified = false;
        if (didDoc.status === 'fulfilled' && requiredCredentials.length > 0) {
          const presentTypes = new Set(
            didDoc.value.credentials.map((c) => c.type),
          );
          credentialsVerified = requiredCredentials.every((req) =>
            presentTypes.has(req),
          );
        } else if (requiredCredentials.length === 0) {
          credentialsVerified = true;
        }

        const approved = scoreApproved && credentialsVerified;

        res.json({
          approved,
          address,
          score,
          rating: hasScore ? scoreResult.value.rating : null,
          scoreApproved,
          credentialsVerified,
          requiredScore,
          requiredCredentials,
          verifiedCredentials: didDoc.status === 'fulfilled'
            ? didDoc.value.credentials.map((c) => c.type)
            : [],
          lastUpdated: hasScore ? scoreResult.value.lastUpdated : null,
        });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  return router;
}
