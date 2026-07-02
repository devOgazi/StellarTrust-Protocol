// Identity API routes — placeholder.
import { Router } from 'express';

const router = Router();

// GET /api/v1/identity/:address — Resolve DID document
router.get('/:address', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/v1/identity/create — Create new DID
router.post('/create', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/v1/identity/credential — Add credential
router.post('/credential', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// DELETE /api/v1/identity/credential/:id — Revoke credential
router.delete('/credential/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

export default router;
