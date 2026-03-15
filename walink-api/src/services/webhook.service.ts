import crypto from 'crypto';
import axios from 'axios';
import { supabase } from '../config/supabase';

// ============================================================
// Webhook Service
// Relays WAHA events to user-configured webhook URLs.
// Each delivery is signed with HMAC-SHA256 using the webhook's
// individual secret, so users can verify authenticity.
// Auto-disables a webhook after 10 consecutive failures.
// ============================================================

interface WebhookConfig {
  id: string;
  url: string;
  secret: string;
  events: string[];
  fail_count: number;
}

/**
 * Sign a payload string with HMAC-SHA256.
 * Returns hex digest prefixed with "sha256=" for easy header verification.
 */
function signPayload(secret: string, body: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Relay an event to all of a user's active webhooks that subscribe to it.
 *
 * @param userId  - The user's UUID we're relaying for
 * @param event   - Event name e.g. 'message.received', 'session.connected'
 * @param payload - The event data to forward
 */
export async function relay(
  userId: string,
  event: string,
  payload: unknown
): Promise<void> {
  try {
    // Fetch all active webhooks for this user that include this event
    const { data: webhooks, error } = await supabase
      .from('webhook_configs')
      .select('id, url, secret, events, fail_count')
      .eq('user_id', userId)
      .eq('is_active', true)
      .contains('events', [event]);

    if (error) {
      console.error('[webhookService.relay] Failed to fetch webhooks:', error.message);
      return;
    }

    if (!webhooks || webhooks.length === 0) return;

    const bodyObj = { event, data: payload, timestamp: Date.now() };
    const bodyStr = JSON.stringify(bodyObj);

    // Fan-out: deliver to each subscribed webhook concurrently
    await Promise.allSettled(
      (webhooks as WebhookConfig[]).map((wh) => deliverOne(wh, event, bodyStr))
    );
  } catch (err) {
    // Top-level catch to ensure relay never throws
    console.error('[webhookService.relay] Unexpected error:', err);
  }
}

async function deliverOne(
  wh: WebhookConfig,
  event: string,
  bodyStr: string
): Promise<void> {
  const signature = signPayload(wh.secret, bodyStr);

  try {
    await axios.post(wh.url, bodyStr, {
      headers: {
        'Content-Type':       'application/json',
        'X-WaLink-Signature': signature,
        'X-WaLink-Event':     event,
      },
      timeout: 10_000, // 10s delivery timeout
    });

    // Success — reset failure counter and record last triggered timestamp
    await supabase
      .from('webhook_configs')
      .update({
        fail_count:        0,
        last_triggered_at: new Date().toISOString(),
        updated_at:        new Date().toISOString(),
      })
      .eq('id', wh.id);
  } catch (err) {
    const newFailCount = typeof wh.fail_count === 'number' ? wh.fail_count + 1 : 1;
    const shouldDisable = newFailCount >= 10;

    console.warn(
      `[webhookService] Delivery failed for webhook ${wh.id} (fail #${newFailCount})${
        shouldDisable ? ' — disabling' : ''
      }`
    );

    // Increment fail count, auto-disable at 10 consecutive failures
    await supabase
      .from('webhook_configs')
      .update({
        fail_count: newFailCount,
        is_active:  shouldDisable ? false : true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wh.id);
  }
}

/**
 * Send a test event to a specific webhook URL and verify its response.
 * Used for user-facing webhook testing.
 */
export async function testWebhook(url: string, secret: string): Promise<{ success: boolean; status_code: number; error?: string }> {
  const bodyObj = {
    event: 'test',
    data: { message: 'This is a test event from WaLink' },
    timestamp: Date.now()
  };
  const bodyStr = JSON.stringify(bodyObj);
  const signature = signPayload(secret, bodyStr);

  try {
    const response = await axios.post(url, bodyStr, {
      headers: {
        'Content-Type':       'application/json',
        'X-WaLink-Signature': signature,
        'X-WaLink-Event':     'test',
      },
      timeout: 10_000,
    });
    
    return { success: true, status_code: response.status };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return { 
        success: false, 
        status_code: err.response?.status ?? 500, 
        error: err.message 
      };
    }
    return { success: false, status_code: 500, error: String(err) };
  }
}
