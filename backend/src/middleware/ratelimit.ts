// Rate limiting middleware — placeholder.
import { Request, Response, NextFunction } from 'express';

export function rateLimitMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
