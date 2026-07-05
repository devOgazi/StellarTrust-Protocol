/**
 * Logger Middleware
 *
 * Structured HTTP request/response logging for the StellarTrust API.
 * Logs in JSON format (suitable for CloudWatch / Datadog ingestion in prod)
 * and human-readable format in development.
 *
 * Each log entry includes:
 *   - method, path, query
 *   - status code, response time (ms)
 *   - IP address (x-forwarded-for aware)
 *   - request ID (injected by requestId middleware)
 *   - account address if authenticated
 */

import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';

// ---------------------------------------------------------------------------
// Request ID injection
// ---------------------------------------------------------------------------

/**
 * Injects a random request ID into `req.headers['x-request-id']` if not
 * already present (e.g. set by a load balancer).  The ID is echoed back in
 * the response as `X-Request-Id`.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id =
    (req.headers['x-request-id'] as string) ??
    `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// ---------------------------------------------------------------------------
// Access logger
// ---------------------------------------------------------------------------

/**
 * Express middleware that logs each HTTP request after the response is sent.
 *
 * In `development` mode the output is a human-readable single line.
 * In all other modes it is a JSON object (one object per line).
 */
export function loggerMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
      req.socket?.remoteAddress ??
      'unknown';
    const requestIdVal = req.headers['x-request-id'] as string | undefined;

    if (process.env.NODE_ENV === 'development') {
      const color =
        res.statusCode >= 500
          ? '\x1b[31m'    // red
          : res.statusCode >= 400
          ? '\x1b[33m'    // yellow
          : res.statusCode >= 300
          ? '\x1b[36m'    // cyan
          : '\x1b[32m';   // green
      const reset = '\x1b[0m';
      console.log(
        `${color}${res.statusCode}${reset} ${req.method} ${req.originalUrl} ` +
        `${duration}ms ${ip}${requestIdVal ? ` [${requestIdVal}]` : ''}`,
      );
    } else {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          duration,
          ip,
          account: req.account,
          requestId: requestIdVal,
        }),
      );
    }
  });

  next();
}

// ---------------------------------------------------------------------------
// Error logger
// ---------------------------------------------------------------------------

/**
 * Error logging middleware — logs unhandled Express errors.
 * Must be registered AFTER routes with four parameters so Express treats it
 * as an error handler.
 */
export function errorLogger(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      method: req.method,
      path: req.originalUrl,
      requestId: req.headers['x-request-id'],
    }),
  );
  next(err);
}
