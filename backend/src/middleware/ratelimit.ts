/**
 * Rate Limiting Middleware
 *
 * Uses express-rate-limit to protect the API from abuse.
 * Different limits are applied to different route groups:
 *
 *   - Standard API routes:    100 requests / 15 min per IP
 *   - Auth endpoints:          20 requests / 15 min per IP (stricter)
 *   - Score/read endpoints:   200 requests / 15 min per IP (looser for reads)
 *   - Lender verify:           50 requests / 15 min per IP
 */

import { Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rateLimitMessage(windowMs: number, max: number) {
  return {
    error: 'Too many requests',
    message: `Rate limit exceeded. Maximum ${max} requests per ${windowMs / 60000} minutes.`,
    retryAfter: windowMs / 1000,
  };
}

function makeRateLimiter(
  max: number,
  windowMs = 15 * 60 * 1000,
): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: rateLimitMessage(windowMs, max),
    // Use req.ip by default; behind a proxy set trustProxy on the app
    keyGenerator: (req: Request) =>
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.ip ??
      'unknown',
    handler: (
      _req: Request,
      res: Response,
    ) => {
      res.status(429).json(rateLimitMessage(windowMs, max));
    },
  });
}

// ---------------------------------------------------------------------------
// Pre-built limiters
// ---------------------------------------------------------------------------

/** Default limiter — 100 req / 15 min */
export const apiRateLimit = makeRateLimiter(100);

/** Auth endpoints — stricter to prevent brute-force */
export const authRateLimit = makeRateLimiter(20);

/** Read-heavy score/identity endpoints */
export const readRateLimit = makeRateLimiter(200);

/** Lender verification — moderate limit */
export const lenderRateLimit = makeRateLimiter(50);

/** Attest endpoint — tight limit (issuer operations) */
export const attestRateLimit = makeRateLimiter(30);
