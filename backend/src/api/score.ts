/**
 * Score API Routes
 *
 * Implements the score endpoints from the README "Key API Endpoints":
 *
 *   GET  /api/v1/score/:address          — Get credit score
 *   GET  /api/v1/score/:address/history  — Score history
 *   GET  /api/v1/score/:address/report   — Full credit report
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ScoreEngineService } from '../services/score-engine';
import { optionalAuth } from '../middleware/auth';
import { readRateLimit } from '../middleware/ratelimit';
import { isValidStellarAddress } from '../utils/stellar';

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createScoreRouter(prisma: PrismaClient): Router {
  const router = Router();
  const engine = new ScoreEngineService(prisma);

  // -------------------------------------------------------------------------
  // GET /api/v1/score/:address  — Get current credit score
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
        const score = await engine.getScore(address);
        res.json(score);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('No score data found')) {
          res.status(404).json({ error: message });
        } else {
          res.status(500).json({ error: message });
        }
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/score/:address/history  — Score history
  // -------------------------------------------------------------------------
  router.get(
    '/:address/history',
    readRateLimit,
    optionalAuth,
    async (req: Request, res: Response): Promise<void> => {
      const { address } = req.params;

      if (!isValidStellarAddress(address)) {
        res.status(400).json({ error: `Invalid Stellar address: ${address}` });
        return;
      }

      const limit = Math.min(
        parseInt(req.query.limit as string) || 20,
        100,
      );
      const offset = parseInt(req.query.offset as string) || 0;

      try {
        const history = await engine.getScoreHistory(address, limit, offset);
        res.json({ address, history, limit, offset });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /api/v1/score/:address/report  — Full credit report
  // -------------------------------------------------------------------------
  router.get(
    '/:address/report',
    readRateLimit,
    optionalAuth,
    async (req: Request, res: Response): Promise<void> => {
      const { address } = req.params;

      if (!isValidStellarAddress(address)) {
        res.status(400).json({ error: `Invalid Stellar address: ${address}` });
        return;
      }

      try {
        const report = await engine.getCreditReport(address);
        res.json(report);
      } catch (err) {
        const message = (err as Error).message;
        if (message.includes('No score data found')) {
          res.status(404).json({ error: message });
        } else {
          res.status(500).json({ error: message });
        }
      }
    },
  );

  return router;
}
