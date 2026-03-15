import { Request } from 'express';

// ============================================================
// User context — shape returned by get_user_by_api_key RPC
// Attached to req.user by apiKeyAuth middleware
// ============================================================
export interface UserContext {
  id: string;
  plan_id: string;
  credits_balance: number;
  is_active: boolean;
  max_sessions: number;
  can_send_files: boolean;
  can_use_webhook: boolean;
  rate_limit_per_min: number;
}

// ============================================================
// Extend Express Request to carry user context + credit cost
// ============================================================
export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  creditCost?: number;
}

// ============================================================
// Message types supported by WAHA
// ============================================================
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location';

// ============================================================
// Credit cost per message type
// text and location = 1 credit, all media types = 3 credits
// ============================================================
export const CREDIT_COSTS: Record<MessageType, number> = {
  text:     1,
  location: 1,
  image:    3,
  video:    3,
  audio:    3,
  file:     3,
};

// ============================================================
// WAHA session status values (mirrors DB enum)
// ============================================================
export type SessionStatus =
  | 'STOPPED'
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'CONNECTED'
  | 'FAILED';

// ============================================================
// Generic RPC result returned by credit service
// ============================================================
export interface CreditResult {
  success: boolean;
  balance?: number;
  error?: string;
}
