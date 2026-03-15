import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { supabase } from '../config/supabase';
import * as webhookService from '../services/webhook.service';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types';

// ============================================================
// PART A: Internal WAHA Receiver Router
// ============================================================
// NO apiKeyAuth — this route is called internally by WAHA container.
// In production, this route MUST be restricted at the network/firewall
// level (e.g. Nginx proxy) to only accept traffic from internal IPs.
// ============================================================
export const internalRouter = Router();

internalRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  // Always return 200 immediately so WAHA doesn't retry
  res.status(200).json({ received: true });

  try {
    const { session: wahaSessionId, event, payload } = req.body as {
      session?: string;
      event?: string;
      payload?: Record<string, unknown>;
    };

    if (!wahaSessionId || !event) {
      console.warn('[webhook.waha] Invalid WAHA payload: missing session or event');
      return;
    }

    // Lookup session in DB
    const { data: session, error: sessionErr } = await supabase
      .from('wa_sessions')
      .select('id, user_id, status')
      .eq('waha_session_id', wahaSessionId)
      .single();

    if (sessionErr || !session) {
      console.warn(`[webhook.waha] Unknown WAHA session: ${wahaSessionId}`);
      return;
    }

    // Handle 'session.status' event
    if (event === 'session.status') {
      const me = payload?.me as { id?: string; status?: string } | undefined;
      const newStatus = (payload?.status ?? me?.status) as string | undefined;

      if (newStatus && newStatus !== session.status) {
        const updateData: Record<string, unknown> = {
          status:     newStatus,
          updated_at: new Date().toISOString(),
        };

        if (newStatus === 'CONNECTED') {
          updateData.connected_at = new Date().toISOString();
          const meId = me?.id;
          if (meId) {
            updateData.phone_number = meId.replace('@c.us', '');
          }
        }

        await supabase
          .from('wa_sessions')
          .update(updateData)
          .eq('id', session.id);
      }
    }

    // All events: Relay to user webhook(s)
    await webhookService.relay(session.user_id, event, {
      session_id: session.id,
      ...payload,
    });
  } catch (err) {
    // Top level catch: log only, WAHA is already 200 OM
    console.error('[webhook.waha] Processing error:', err);
  }
});


// ============================================================
// PART B: User-Facing API Router
// ============================================================
// Secured by API key + Rate Limiting. Manages user webhook configs.
// ============================================================
export const apiRouter = Router();

apiRouter.use(apiKeyAuth as never);
apiRouter.use(rateLimiter as never);

/** Mask all but last 4 characters of the secret for response output */
function maskSecret(secret: string): string {
  if (!secret || secret.length < 4) return '••••••••';
  return '••••••••' + secret.slice(-4);
}

// ------------------------------------------------------------
// GET /api/webhooks
// List user webhooks (with masked secrets).
// ------------------------------------------------------------
apiRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const { data, error } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const maskedData = (data ?? []).map((wh) => ({
      ...wh,
      secret: maskSecret(wh.secret),
    }));

    res.json({ webhooks: maskedData });
  } catch (err) {
    console.error('[GET /api/webhooks]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------------
// POST /api/webhooks
// Create a new webhook config (max 5 per user).
// ------------------------------------------------------------
const createWebhookSchema = z.object({
  url: z.string().url().refine(val => val.startsWith('https://'), {
    message: 'url must be a valid HTTPS URL',
  }),
  events: z.array(z.string()).min(1, 'At least one event is required').refine(
    (events) => events.every(e => ['message.received', 'session.connected', 'session.disconnected'].includes(e)),
    { message: 'Invalid events listed' }
  ),
});

apiRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const parsed = createWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message });
      return;
    }

    if (!user.can_use_webhook) {
      res.status(403).json({ error: 'Your current plan does not support webhooks. Upgrade to Starter or higher.' });
      return;
    }

    const { count, error: countErr } = await supabase
      .from('webhook_configs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countErr) throw countErr;

    if ((count ?? 0) >= 5) {
      res.status(400).json({ error: 'Maximum limit of 5 webhooks reached.' });
      return;
    }

    const secret = crypto.randomBytes(16).toString('hex'); // 32 hex chars
    const { data: created, error: createErr } = await supabase
      .from('webhook_configs')
      .insert({
        user_id: user.id,
        url: parsed.data.url,
        events: parsed.data.events,
        secret,
      })
      .select()
      .single();

    if (createErr) throw createErr;

    res.status(201).json({
      webhook: created,
      secret_note: 'Save this secret, it will not be shown again in full',
    });
  } catch (err) {
    console.error('[POST /api/webhooks]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------------
// PUT /api/webhooks/:id
// Update an existing webhook config.
// ------------------------------------------------------------
const updateWebhookSchema = z.object({
  url: z.string().url().refine(val => val.startsWith('https://'), {
    message: 'url must be a valid HTTPS URL',
  }).optional(),
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
});

apiRouter.put('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const parsed = updateWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message });
      return;
    }

    const { data: webhook, error: findErr } = await supabase
      .from('webhook_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (findErr || !webhook) {
      res.status(404).json({ error: 'Webhook not found.' });
      return;
    }

    const { data: updated, error: updateErr } = await supabase
      .from('webhook_configs')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({
      webhook: {
        ...updated,
        secret: maskSecret(updated.secret),
      },
    });
  } catch (err) {
    console.error('[PUT /api/webhooks/:id]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------------
// DELETE /api/webhooks/:id
// Delete a webhook config.
// ------------------------------------------------------------
apiRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const { data: webhook, error: findErr } = await supabase
      .from('webhook_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (findErr || !webhook) {
      res.status(404).json({ error: 'Webhook not found.' });
      return;
    }

    const { error: delErr } = await supabase
      .from('webhook_configs')
      .delete()
      .eq('id', req.params.id);

    if (delErr) throw delErr;

    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/webhooks/:id]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------------
// POST /api/webhooks/:id/test
// Send a test payload to the webhook URL.
// ------------------------------------------------------------
apiRouter.post('/:id/test', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const { data: webhook, error: findErr } = await supabase
      .from('webhook_configs')
      .select('id, url, secret')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (findErr || !webhook) {
      res.status(404).json({ error: 'Webhook not found.' });
      return;
    }

    const result = await webhookService.testWebhook(webhook.url, webhook.secret);

    if (!result.success) {
      res.status(500).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('[POST /api/webhooks/:id/test]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ------------------------------------------------------------
// POST /api/webhooks/:id/regenerate-secret
// Regenerate the signing secret for a webhook.
// ------------------------------------------------------------
apiRouter.post('/:id/regenerate-secret', async (req: Request, res: Response): Promise<void> => {
  const user = (req as AuthenticatedRequest).user!;

  try {
    const { data: webhook, error: findErr } = await supabase
      .from('webhook_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (findErr || !webhook) {
      res.status(404).json({ error: 'Webhook not found.' });
      return;
    }

    const secret = crypto.randomBytes(16).toString('hex');

    const { error: updateErr } = await supabase
      .from('webhook_configs')
      .update({ secret, updated_at: new Date().toISOString() })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;

    res.json({ 
      secret,
      note: 'Update your application with this new secret. Previous signatures will now fail verification.'
    });
  } catch (err) {
    console.error('[POST /api/webhooks/:id/regenerate-secret]', err);
    res.status(500).json({ error: 'Database error' });
  }
});
