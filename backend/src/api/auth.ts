/**
 * Auth API Routes (SEP-0010)
 *
 * Exposes the SEP-0010 Stellar Web Authentication endpoints:
 *
 *   GET  /api/v1/auth?account=G...     — Get challenge transaction
 *   POST /api/v1/auth                  — Submit signed tx, receive JWT
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  buildChallenge,
  verifyChallengeAndIssueJWT,
} from '../middleware/auth';
import { authRateLimit } from '../middleware/ratelimit';
import { isValidStellarAddress } from '../utils/stellar';

const SubmitChallengeSchema = z.object({
  account: z.string(),
  transaction: z.string(),
});

export function createAuthRouter(): Router {
  const router = Router();

  // GET /api/v1/auth?account=G...
  router.get(
    '/',
    authRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const account = req.query.account as string;
      if (!account || !isValidStellarAddress(account)) {
        res.status(400).json({ error: 'Valid Stellar account address required' });
        return;
      }
      try {
        const challenge = buildChallenge(account);
        res.json(challenge);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // POST /api/v1/auth
  router.post(
    '/',
    authRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = SubmitChallengeSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'account and transaction are required' });
        return;
      }
      const { account, transaction } = parsed.data;
      if (!isValidStellarAddress(account)) {
        res.status(400).json({ error: `Invalid Stellar account: ${account}` });
        return;
      }
      try {
        const token = verifyChallengeAndIssueJWT(account, transaction);
        res.json({ token });
      } catch (err) {
        res.status(401).json({ error: (err as Error).message });
      }
    },
  );

  return router;
}
