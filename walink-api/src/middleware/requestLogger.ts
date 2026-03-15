import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

// ============================================================
// requestLogger middleware
// - Logs each request on response finish
// - Format: [METHOD] /path → STATUS  (DURATIONms) [userId]
// ============================================================
export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  _res.on('finish', () => {
    const authReq = req as AuthenticatedRequest;
    const duration = Date.now() - start;
    const userId = authReq.user?.id ?? 'anonymous';
    const status = _res.statusCode;

    const statusLabel =
      status >= 500
        ? '🔴'
        : status >= 400
        ? '🟡'
        : status >= 300
        ? '🔵'
        : '🟢';

    console.log(
      `${statusLabel} [${req.method}] ${req.path} → ${status}  (${duration}ms)  [${userId}]`
    );
  });

  next();
}
