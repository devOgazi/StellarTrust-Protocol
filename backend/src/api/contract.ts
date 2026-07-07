import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { nativeToScVal } from '@stellar/stellar-sdk';
import { simulateContractCall } from '../utils/stellar';
import { apiRateLimit } from '../middleware/ratelimit';

const SimulateSchema = z.object({
  contractId: z.string(),
  method: z.string(),
  args: z.array(z.unknown()).default([]),
  sourceAccount: z.string().optional(),
});

function toScVal(value: unknown): any {
  if (typeof value === 'string') return nativeToScVal(value, { type: 'symbol' });
  if (typeof value === 'number') return nativeToScVal(value, { type: 'i128' });
  if (typeof value === 'boolean') return nativeToScVal(value);
  if (Array.isArray(value)) return nativeToScVal(value.map(toScVal));
  return nativeToScVal(String(value), { type: 'symbol' });
}

export function createContractRouter(): Router {
  const router = Router();

  router.post(
    '/simulate',
    apiRateLimit,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = SimulateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation error', details: parsed.error.issues });
        return;
      }

      const { contractId, method, args, sourceAccount } = parsed.data;
      const dummySource = sourceAccount ?? 'GAHK7...';

      try {
        const scArgs = args.map(toScVal);
        const result = await simulateContractCall({
          contractId,
          method,
          args: scArgs,
          sourceAccount: dummySource,
        });
        res.json({ success: true, result });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    },
  );

  return router;
}
