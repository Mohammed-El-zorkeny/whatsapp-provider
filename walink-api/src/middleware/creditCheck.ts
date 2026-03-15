import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, CREDIT_COSTS, MessageType } from '../types';

// ============================================================
// creditCheck middleware
// - Must run AFTER apiKeyAuth (depends on req.user)
// - Reads type from req.body (defaults to 'text')
// - Checks user has enough credits before allowing the request
// - Attaches the cost to req.creditCost for handlers to use
// - Credits are NOT deducted here — only checked.
//   Deduction happens in the message handler AFTER WAHA confirms.
// ============================================================
export function creditCheck(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;

  // Guard — should never hit this if apiKeyAuth is applied first
  if (!authReq.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const msgType = (req.body?.type as MessageType) ?? 'text';
  const cost = CREDIT_COSTS[msgType] ?? CREDIT_COSTS['text'];

  if (authReq.user.credits_balance < cost) {
    res.status(402).json({
      error: 'Insufficient credits.',
      balance: authReq.user.credits_balance,
      required: cost,
    });
    return;
  }

  // Stash cost on the request for the route handler
  authReq.creditCost = cost;
  next();
}
