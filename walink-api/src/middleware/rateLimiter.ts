import { Request, Response, NextFunction } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '../config/env';
import { AuthenticatedRequest } from '../types';

// ============================================================
// Upstash Redis client (singleton)
// ============================================================
const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

// ============================================================
// rateLimiter middleware
// - Must run AFTER apiKeyAuth (depends on req.user)
// - Uses a per-user sliding window keyed on user UUID
// - The window size and limit are plan-specific (rate_limit_per_min)
// - A new Ratelimit instance is created per request because the
//   limit itself is dynamic per user plan. This is acceptable
//   since Upstash SDK instances are lightweight.
// ============================================================
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  const { id, rate_limit_per_min } = authReq.user;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rate_limit_per_min, '1 m'),
    prefix: 'walink:rl',
  });

  const { success, limit, remaining, reset } = await limiter.limit(id);

  // Set standard rate limit headers regardless of outcome
  res.setHeader('X-RateLimit-Limit', limit);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', reset);

  if (!success) {
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
    res.status(429).json({
      error: 'Rate limit exceeded.',
      retry_after: retryAfterSeconds,
    });
    return;
  }

  next();
}
