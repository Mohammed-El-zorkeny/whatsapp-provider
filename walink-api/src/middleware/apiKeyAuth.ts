import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthenticatedRequest, UserContext } from '../types';

// ============================================================
// apiKeyAuth middleware
// - Reads x-api-key header
// - All WaLink API keys start with "wl_live_"
// - Calls get_user_by_api_key RPC (indexed — O(1) lookup)
// - Attaches user context to req.user
// ============================================================
export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'];

  // Header missing or not a string
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({
      error: 'Missing API key. Provide it via the x-api-key header.',
    });
    return;
  }

  // All WaLink keys must start with wl_live_
  if (!apiKey.startsWith('wl_live_')) {
    res.status(401).json({
      error: 'Invalid API key format.',
    });
    return;
  }

  // Call the Supabase RPC — indexed on profiles.api_key
  const { data, error } = await supabase.rpc('get_user_by_api_key', {
    p_api_key: apiKey,
  });

  if (error) {
    console.error('[apiKeyAuth] RPC error:', error.message);
    res.status(500).json({ error: 'Auth service unavailable.' });
    return;
  }

  // RPC returns a table — first row is the user
  const user = Array.isArray(data) ? (data[0] as UserContext | undefined) : undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid or unrecognized API key.' });
    return;
  }

  if (!user.is_active) {
    res.status(403).json({
      error: 'Account is suspended. Please contact support.',
    });
    return;
  }

  // Attach to request for downstream middleware and handlers
  (req as AuthenticatedRequest).user = user;
  next();
}
