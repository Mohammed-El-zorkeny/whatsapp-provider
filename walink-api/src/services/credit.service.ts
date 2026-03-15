import { supabase } from '../config/supabase';
import { CreditResult } from '../types';

// ============================================================
// Credit Service
// Thin wrappers around the Supabase RPC functions defined in
// migration 00009. Both functions run as security definer and
// write to the credit_transactions ledger atomically.
// ============================================================

/**
 * Deduct credits from a user's balance.
 * Uses FOR UPDATE row lock inside the RPC — safe for concurrent requests.
 *
 * @param userId      - The user's UUID (from profiles.id)
 * @param amount      - Number of credits to deduct (positive integer)
 * @param description - Human-readable reason (e.g. "Send text message")
 * @param refId       - Optional reference UUID (e.g. message_log.id)
 */
export async function deduct(
  userId: string,
  amount: number,
  description: string,
  refId?: string
): Promise<CreditResult> {
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_user_id:    userId,
    p_amount:     amount,
    p_description: description,
    p_ref_id:     refId ?? null,
  });

  if (error) {
    console.error('[creditService.deduct] RPC error:', error.message);
    return { success: false, error: error.message };
  }

  return data as CreditResult;
}

/**
 * Add credits to a user's balance.
 * Called after a payment webhook confirms a successful payment.
 *
 * @param userId      - The user's UUID (from profiles.id)
 * @param amount      - Number of credits to add (positive integer)
 * @param type        - Transaction type: 'purchase' | 'bonus' | 'refund' | 'plan_renewal'
 * @param description - Human-readable reason
 * @param refId       - Optional reference UUID (e.g. payments.id)
 */
export async function add(
  userId: string,
  amount: number,
  type: string,
  description: string,
  refId?: string
): Promise<CreditResult> {
  const { data, error } = await supabase.rpc('add_credits', {
    p_user_id:    userId,
    p_amount:     amount,
    p_type:       type,
    p_description: description,
    p_ref_id:     refId ?? null,
  });

  if (error) {
    console.error('[creditService.add] RPC error:', error.message);
    return { success: false, error: error.message };
  }

  return data as CreditResult;
}
