// Request logging middleware — placeholder.
import { Request, Response, NextFunction } from 'express';

export function loggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  console.log(`${req.method} ${req.path}`);
  next();
}
