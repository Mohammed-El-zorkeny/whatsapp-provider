import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import { supabase } from '../config/supabase';
import * as wahaService from '../services/waha.service';
import { AuthenticatedRequest, SessionStatus } from '../types';

const router = Router();

// ============================================================
// Middleware chain — applied to ALL session routes
// ============================================================
router.use(apiKeyAuth as never);
router.use(rateLimiter as never);

// ============================================================
// Helpers
// ============================================================

/** ISO timestamp for DB writes */
const now = () => new Date().toISOString();

/** Structured console error with timestamp and user context */
function logError(route: string, userId: string, err: unknown): void {
  console.error(
    `[${new Date().toISOString()}] [sessions.${route}] user=${userId}`,
    err instanceof Error ? err.message : err
  );
}

/**
 * Fetch live WAHA status for a session and sync it to the DB.
 * Returns the current WahaSessionInfo, or null if WAHA is unreachable.
 *
 * Side-effects written to DB:
 *  - Always: status + updated_at
 *  - On CONNECTED: phone_number (stripped of @c.us) + connected_at
 */
async function syncSessionFromWaha(
  sessionId: string,
  wahaSessionId: string,
  userId: string
): Promise<wahaService.WahaSessionInfo | null> {
  try {
    const wahaData = await wahaService.getSession(wahaSessionId);
    const wahaStatus = wahaData.status as SessionStatus;

    const updatePayload: Record<string, unknown> = {
      status:     wahaStatus,
      updated_at: now(),
    };

    // Extract phone number when the session becomes CONNECTED
    if (wahaStatus === 'CONNECTED' && wahaData.me?.id) {
      updatePayload.phone_number = wahaData.me.id.replace('@c.us', '');
      updatePayload.connected_at = now();
    }

    await supabase
      .from('wa_sessions')
      .update(updatePayload)
      .eq('id', sessionId);

    return wahaData;
  } catch (err) {
    logError('syncSessionFromWaha', userId, err);
    return null; // Non-fatal — fall back to DB state
  }
}

// ============================================================
// GET /api/sessions
// List all sessions for the authenticated user.
// For sessions that are CONNECTED or STARTING, also sync their
// live WAHA status before responding.
// ============================================================
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const { data: sessions, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logError('GET /', userId, error);
      res.status(500).json({ error: 'Database error.' });
      return;
    }

    // Sync live status for active sessions in parallel (best effort)
    const toSync = (sessions ?? []).filter((s) =>
      ['CONNECTED', 'STARTING', 'SCAN_QR_CODE'].includes(s.status)
    );

    await Promise.allSettled(
      toSync.map((s) => syncSessionFromWaha(s.id, s.waha_session_id, userId))
    );

    // Re-fetch after sync so response reflects updated statuses
    const { data: refreshed, error: refreshErr } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (refreshErr) {
      logError('GET / refresh', userId, refreshErr);
      // Return original data rather than failing completely
      res.json({ sessions: sessions ?? [] });
      return;
    }

    res.json({ sessions: refreshed ?? [] });
  } catch (err) {
    logError('GET /', userId, err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// POST /api/sessions
// Create a new WhatsApp session and start it via WAHA.
//
// Session limit counts ALL non-STOPPED sessions — because a
// session in STARTING or SCAN_QR_CODE still occupies a WAHA slot.
// ============================================================
const createSessionSchema = z.object({
  session_name: z
    .string({ required_error: 'session_name is required.' })
    .min(1, 'session_name cannot be empty.')
    .max(30, 'session_name must be 30 characters or fewer.')
    .regex(/^[a-zA-Z0-9-]+$/, {
      message: 'session_name can only contain letters, numbers, and dashes.',
    })
    .transform((v) => v.toLowerCase()),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  try {
    // Validate body
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0]?.message });
      return;
    }
    const { session_name } = parsed.data;

    // Count ALL non-STOPPED sessions — STARTING/SCAN_QR_CODE still use a slot
    const { count, error: countErr } = await supabase
      .from('wa_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'STOPPED');

    if (countErr) {
      logError('POST /', user.id, countErr);
      res.status(500).json({ error: 'Database error.' });
      return;
    }

    if ((count ?? 0) >= user.max_sessions) {
      res.status(403).json({
        error: `Plan limit reached. Your ${user.plan_id} plan allows ${user.max_sessions} session(s). Upgrade to add more.`,
      });
      return;
    }

    // WAHA session ID: first 8 chars of userId + session name
    // Prevents cross-user collisions on shared WAHA instances
    const wahaSessionId = `${user.id.slice(0, 8)}_${session_name}`;

    // Insert DB row first with status STARTING
    const { data: sessionRow, error: insertErr } = await supabase
      .from('wa_sessions')
      .insert({
        user_id:         user.id,
        session_name,
        waha_session_id: wahaSessionId,
        status:          'STARTING',
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        res.status(409).json({
          error: `A session named "${session_name}" already exists.`,
        });
        return;
      }
      logError('POST / insert', user.id, insertErr);
      res.status(500).json({ error: 'Database error.' });
      return;
    }

    // Start the session in WAHA — roll back DB row on failure
    try {
      await wahaService.startSession(wahaSessionId);
    } catch (wahaErr) {
      // Rollback: remove the DB row since WAHA failed to start
      await supabase.from('wa_sessions').delete().eq('id', sessionRow.id);
      logError('POST / WAHA start', user.id, wahaErr);
      res.status(500).json({
        error: 'WAHA error',
        detail: wahaErr instanceof Error ? wahaErr.message : String(wahaErr),
      });
      return;
    }

    res.status(201).json({ session: sessionRow });
  } catch (err) {
    logError('POST /', (req as AuthenticatedRequest).user?.id ?? 'unknown', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// GET /api/sessions/:id/qr
// Return the QR code image for the user to scan.
//
// Returns:
//   200  { qr_code: "data:image/png;base64,..." }   — QR ready
//   202  { message: "QR not ready, retry in 3 seconds" }  — still starting
//   400  if already CONNECTED (no QR needed)
//   404  if session not found / wrong owner
// ============================================================
router.get('/:id/qr', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const { data: session, error } = await supabase
      .from('wa_sessions')
      .select('id, waha_session_id, status')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (session.status === 'CONNECTED') {
      res.status(400).json({
        error: 'Session is already connected. No QR needed.',
        status: 'CONNECTED',
      });
      return;
    }

    if (session.status === 'FAILED') {
      res.status(400).json({
        error: 'Session has failed. Use POST /:id/restart to try again.',
        status: 'FAILED',
      });
      return;
    }

    // Fetch QR from WAHA (returns QR_NOT_READY sentinel or WahaQRResult)
    let qrResult: wahaService.WahaQRResult | typeof wahaService.QR_NOT_READY;
    try {
      qrResult = await wahaService.getQR(session.waha_session_id);
    } catch (err) {
      logError('GET /:id/qr', userId, err);
      res.status(500).json({
        error: 'WAHA error',
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (qrResult === wahaService.QR_NOT_READY) {
      // Session is still initializing — client should poll again shortly
      res.status(202).json({
        message: 'QR not ready, retry in 3 seconds',
        status:  session.status,
      });
      return;
    }

    // Update DB to mark that we're in the QR scan phase
    if (session.status !== 'SCAN_QR_CODE') {
      await supabase
        .from('wa_sessions')
        .update({ status: 'SCAN_QR_CODE', updated_at: now() })
        .eq('id', session.id);
    }

    res.json({ qr_code: qrResult.dataUri });
  } catch (err) {
    logError('GET /:id/qr', (req as AuthenticatedRequest).user?.id ?? 'unknown', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// GET /api/sessions/:id/status
// Poll the live status of a session from WAHA and sync it to DB.
//
// Always syncs: status + updated_at
// On CONNECTED: also syncs phone_number + connected_at
// ============================================================
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const { data: session, error } = await supabase
      .from('wa_sessions')
      .select('id, waha_session_id, status, phone_number, connected_at')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Sync from WAHA — null means WAHA unreachable, fall back to DB state
    const wahaData = await syncSessionFromWaha(
      session.id,
      session.waha_session_id,
      userId
    );

    const currentStatus = wahaData?.status ?? session.status;
    const phoneNumber =
      wahaData?.me?.id?.replace('@c.us', '') ?? session.phone_number;

    const response: Record<string, unknown> = {
      status: currentStatus,
      synced: wahaData !== null,
    };

    if (phoneNumber) response.phone_number = phoneNumber;
    if (currentStatus === 'CONNECTED') {
      response.connected_at = session.connected_at ?? now();
    }
    if (wahaData?.me?.pushName) {
      response.push_name = wahaData.me.pushName;
    }

    res.json(response);
  } catch (err) {
    logError('GET /:id/status', (req as AuthenticatedRequest).user?.id ?? 'unknown', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// DELETE /api/sessions/:id
// Stop the WAHA session and remove it from DB permanently.
// WAHA stop is best-effort — DB delete always happens.
// ============================================================
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const { data: session, error } = await supabase
      .from('wa_sessions')
      .select('id, waha_session_id, status')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Attempt WAHA stop — log and continue on failure
    try {
      await wahaService.stopSession(session.waha_session_id);
    } catch (wahaErr) {
      logError(
        `DELETE /:id WAHA stop (${session.waha_session_id})`,
        userId,
        wahaErr
      );
      // Intentionally not returning — always delete from DB
    }

    const { error: deleteErr } = await supabase
      .from('wa_sessions')
      .delete()
      .eq('id', session.id);

    if (deleteErr) {
      logError('DELETE /:id DB delete', userId, deleteErr);
      res.status(500).json({ error: 'Database error.' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logError('DELETE /:id', (req as AuthenticatedRequest).user?.id ?? 'unknown', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// POST /api/sessions/:id/restart
// Restart a session that is in FAILED or STOPPED status.
// Reuses the existing waha_session_id — no new DB row created.
// ============================================================
router.post('/:id/restart', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const { data: session, error } = await supabase
      .from('wa_sessions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (error || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    // Only allow restart from terminal/idle states
    const restartableStates: SessionStatus[] = ['FAILED', 'STOPPED'];
    if (!restartableStates.includes(session.status as SessionStatus)) {
      res.status(400).json({
        error: `Cannot restart a session with status "${session.status}". Only FAILED or STOPPED sessions can be restarted.`,
        status: session.status,
      });
      return;
    }

    // Re-start session in WAHA using the same waha_session_id
    try {
      await wahaService.startSession(session.waha_session_id);
    } catch (wahaErr) {
      logError('POST /:id/restart WAHA start', userId, wahaErr);
      res.status(500).json({
        error: 'WAHA error',
        detail: wahaErr instanceof Error ? wahaErr.message : String(wahaErr),
      });
      return;
    }

    // Update DB status to STARTING
    const { data: updated, error: updateErr } = await supabase
      .from('wa_sessions')
      .update({
        status:       'STARTING',
        phone_number: null,
        connected_at: null,
        qr_code:      null,
        updated_at:   now(),
      })
      .eq('id', session.id)
      .select()
      .single();

    if (updateErr) {
      logError('POST /:id/restart DB update', userId, updateErr);
      res.status(500).json({ error: 'Database error.' });
      return;
    }

    res.json({ session: updated });
  } catch (err) {
    logError('POST /:id/restart', (req as AuthenticatedRequest).user?.id ?? 'unknown', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
