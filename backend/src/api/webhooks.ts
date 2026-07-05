/**
 * Webhook Handlers
 *
 * Receives push notifications from Horizon / external services and feeds
 * events into the local Postgres WebhookEvent table for processing by the
 * event-listener worker.
 *
 * Endpoints:
 *   POST /api/v1/webhooks/horizon  — Horizon streaming event callback
 *   POST /api/v1/webhooks/kyc      — KYC provider result callback (Phase 2)
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { apiRateLimit } from '../middleware/ratelimit';

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

export function createWebhookRouter(prisma: PrismaClient): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // POST /api/v1/webhooks/horizon  — Horizon event callback
  // -------------------------------------------------------------------------
  router.post(
    '/horizon',
    apiRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const payload = req.body as Record<string, unknown>;

      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ error: 'Invalid payload' });
        return;
      }

      try {
        await prisma.webhookEvent.create({
          data: {
            eventType: (payload.type as string) ?? 'horizon',
            contractId: (payload.contract_id as string) ?? '',
            ledgerSeq: (payload.ledger as number) ?? 0,
            payload: payload as Prisma.InputJsonValue,
            processed: false,
          },
        });
        res.status(202).json({ message: 'Event queued for processing' });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // POST /api/v1/webhooks/kyc  — KYC provider result callback (Phase 2 stub)
  // -------------------------------------------------------------------------
  router.post(
    '/kyc',
    apiRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      // TODO (Phase 2): verify provider HMAC signature, then trigger
      // attestation issuance based on KYC result
      const payload = req.body as Record<string, unknown>;

      try {
        await prisma.webhookEvent.create({
          data: {
            eventType: 'kyc_result',
            contractId: '',
            ledgerSeq: 0,
            payload: payload as Prisma.InputJsonValue,
            processed: false,
          },
        });
        res.status(202).json({ message: 'KYC result queued for processing' });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  return router;
}
