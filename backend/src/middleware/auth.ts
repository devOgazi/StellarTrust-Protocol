// SEP-0010 JWT auth middleware — placeholder.
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next();
}
