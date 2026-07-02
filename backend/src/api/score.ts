// Score API routes — placeholder.
import { Router } from 'express';

const router = Router();

// GET /api/v1/score/:address
router.get('/:address', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/v1/score/:address/history
router.get('/:address/history', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/v1/score/:address/report
router.get('/:address/report', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
