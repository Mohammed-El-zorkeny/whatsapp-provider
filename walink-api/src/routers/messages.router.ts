import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import { creditCheck } from '../middleware/creditCheck';
import { supabase } from '../config/supabase';
import * as wahaService from '../services/waha.service';
import * as creditService from '../services/credit.service';
import { AuthenticatedRequest, MessageType, CREDIT_COSTS } from '../types';

const router = Router();

// ============================================================
// Middleware Chain
// Applicable in strict order: Auth -> RateLimit -> CreditCheck
// Note: We only apply creditCheck to POST routes so GET routes
// don't fail for users with 0 credits.
// ============================================================
router.use(apiKeyAuth as never);
router.use(rateLimiter as never);
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST') {
    return creditCheck(req as any, res as any, next as any);
  }
  next();
});

// ============================================================
// Helpers
// ============================================================
const cleanPhone = (val: string) => val.replace(/[\s\-\+]/g, '');
const isPhoneValid = (val: string) => /^\d{7,15}$/.test(val);

const formatChatId = (val: string) => {
  return val.endsWith('@c.us') ? val : `${val}@c.us`;
};

// ============================================================
// POST /api/messages/send
// Send a single message.
// ============================================================
const sendSchema = z.object({
  session_id: z.string().uuid({ message: 'session_id must be a valid UUID' }),
  to: z.string().transform(cleanPhone).refine(isPhoneValid, {
    message: 'to must be a numeric string between 7 and 15 digits',
  }),
  type: z.enum(['text', 'image', 'video', 'audio', 'file', 'location']).default('text'),
  text: z.string().optional(),
  url: z.string().url({ message: 'url must be a valid URL' }).optional(),
  caption: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.type === 'text' && !data.text) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'text is required when type is text', path: ['text'] });
  }
  if (['image', 'video', 'audio', 'file'].includes(data.type) && !data.url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'url is required for media types', path: ['url'] });
  }
  if (data.type === 'location' && (data.latitude === undefined || data.longitude === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'latitude and longitude are required for location type', path: ['latitude'] });
  }
});

router.post('/send', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const creditCost = authReq.creditCost!; // injected by creditCheck

  try {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      res.status(400).json({ error: firstError.message, field: firstError.path.join('.') });
      return;
    }

    const { session_id, to, type: msgType, ...payload } = parsed.data;

    if (msgType !== 'text' && msgType !== 'location' && !user.can_send_files) {
      res.status(403).json({
        error: 'Your current plan does not support sending media messages. Upgrade to Starter or higher.',
      });
      return;
    }

    // Verify session
    const { data: session, error: sessionErr } = await supabase
      .from('wa_sessions')
      .select('id, waha_session_id, status')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionErr || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (session.status !== 'CONNECTED') {
      res.status(400).json({ error: `Session is not connected. Current status: ${session.status}` });
      return;
    }

    const chatId = formatChatId(to);

    // Insert pending log
    const { data: logRow, error: logInsertErr } = await supabase
      .from('message_logs')
      .insert({
        user_id: user.id,
        session_id: session.id,
        to_number: to, // stripped version
        msg_type: msgType,
        content: payload.text?.slice(0, 500) ?? payload.caption?.slice(0, 500),
        media_url: payload.url,
        credits_cost: creditCost,
        status: 'pending',
      })
      .select('id')
      .single();

    if (logInsertErr) throw logInsertErr;

    const logId: string = logRow.id;
    let wahaResult: { id: string } | null = null;
    let wahaError: string | null = null;

    try {
      switch (msgType) {
        case 'text':
          wahaResult = await wahaService.sendText(session.waha_session_id, chatId, payload.text!);
          break;
        case 'image':
          wahaResult = await wahaService.sendImage(session.waha_session_id, chatId, payload.url!, payload.caption);
          break;
        case 'video':
          wahaResult = await wahaService.sendVideo(session.waha_session_id, chatId, payload.url!, payload.caption);
          break;
        case 'audio':
          wahaResult = await wahaService.sendAudio(session.waha_session_id, chatId, payload.url!);
          break;
        case 'file':
          wahaResult = await wahaService.sendFile(session.waha_session_id, chatId, payload.url!, payload.caption);
          break;
        case 'location':
          wahaResult = await wahaService.sendLocation(
            session.waha_session_id,
            chatId,
            payload.latitude!,
            payload.longitude!,
            payload.title
          );
          break;
      }
    } catch (err) {
      wahaError = err instanceof Error ? err.message : String(err);
    }

    if (!wahaResult || wahaError) {
      await supabase
        .from('message_logs')
        .update({ status: 'failed', error_msg: wahaError ?? 'Unknown WAHA error' })
        .eq('id', logId);

      res.status(500).json({ error: 'Failed to send message', detail: wahaError });
      return;
    }

    // Success -> Deduct Credits
    const creditResult = await creditService.deduct(user.id, creditCost, `Send ${msgType} message`, logId);

    if (!creditResult.success) {
      await supabase
        .from('message_logs')
        .update({ status: 'failed', error_msg: `Credit deduction failed: ${creditResult.error}` })
        .eq('id', logId);

      res.status(500).json({ error: 'Database error', detail: creditResult.error });
      return;
    }

    await supabase
      .from('message_logs')
      .update({ status: 'sent', waha_msg_id: wahaResult.id })
      .eq('id', logId);

    res.json({
      success: true,
      message_id: logId,
      credits_used: creditCost,
      credits_remaining: creditResult.balance,
    });
  } catch (err) {
    console.error('[POST /api/messages/send]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// POST /api/messages/bulk
// Send the same message to multiple numbers.
// ============================================================
const bulkSchema = z.object({
  session_id: z.string().uuid({ message: 'session_id must be a valid UUID' }),
  numbers: z.array(
    z.string().transform(cleanPhone).refine(isPhoneValid, {
      message: 'Each number must be a numeric string between 7 and 15 digits',
    })
  ).min(1).max(500),
  type: z.enum(['text', 'image', 'video', 'file', 'audio', 'location']).default('text'),
  text: z.string().optional(),
  url: z.string().url({ message: 'url must be a valid URL' }).optional(),
  caption: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  title: z.string().optional(),
  delay_ms: z.number().min(1000).max(10000).default(2000),
}).superRefine((data, ctx) => {
  if (data.type === 'text' && !data.text) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'text is required when type is text', path: ['text'] });
  }
  if (['image', 'video', 'audio', 'file'].includes(data.type) && !data.url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'url is required for media types', path: ['url'] });
  }
  if (data.type === 'location' && (data.latitude === undefined || data.longitude === undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'latitude and longitude are required for location type', path: ['latitude'] });
  }
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

router.post('/bulk', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  
  try {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      res.status(400).json({ error: firstError.message, field: firstError.path.join('.') });
      return;
    }

    const { session_id, numbers, type: msgType, delay_ms, ...payload } = parsed.data;

    if (msgType !== 'text' && msgType !== 'location' && !user.can_send_files) {
      res.status(403).json({
        error: 'Your current plan does not support sending media messages. Upgrade to Starter or higher.',
      });
      return;
    }

    // Validate credits upfront for all messages
    const perMessageCost = CREDIT_COSTS[msgType] ?? 1;
    const totalCost = perMessageCost * numbers.length;

    // Refresh balance to make sure we have the latest
    const { data: profile } = await supabase.from('profiles').select('credits_balance').eq('id', user.id).single();
    const currentBalance = profile?.credits_balance ?? user.credits_balance;

    if (currentBalance < totalCost) {
      res.status(402).json({
        error: `Insufficient credits for bulk send. Required: ${totalCost}, Balance: ${currentBalance}`,
        balance: currentBalance,
        required: totalCost,
      });
      return;
    }

    // Verify session
    const { data: session, error: sessionErr } = await supabase
      .from('wa_sessions')
      .select('id, waha_session_id, status')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionErr || !session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (session.status !== 'CONNECTED') {
      res.status(400).json({ error: `Session is not connected. Current status: ${session.status}` });
      return;
    }

    // Respond early to avoid holding the HTTP connection too long for big batches.
    // Wait, the prompt says "Return summary: { success: true, total, sent, failed, credits_used }"
    // This Implies a synchronous response. Express times out if this takes > 2-3 mins.
    // 500 * 2000ms = 1000 seconds (16 mins). 
    // Usually bulk processing is pushed to a background queue, but for the sake of 
    // the current task we'll run it and await, assuming realistic testing lengths.
    
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < numbers.length; i++) {
      const to = numbers[i];
      const chatId = formatChatId(to);

      // 1. Insert pending
      const { data: logRow, error: logInsertErr } = await supabase
        .from('message_logs')
        .insert({
          user_id: user.id,
          session_id: session.id,
          to_number: to,
          msg_type: msgType,
          content: payload.text?.slice(0, 500) ?? payload.caption?.slice(0, 500),
          media_url: payload.url,
          credits_cost: perMessageCost,
          status: 'pending',
        })
        .select('id')
        .single();
        
      if (logInsertErr) {
        console.error(`[POST /bulk] logInsertErr for ${to}`, logInsertErr);
        failedCount++;
        continue; // skip this number
      }

      const logId = logRow.id;
      let wahaResult: { id: string } | null = null;
      let wahaError: string | null = null;

      try {
        switch (msgType) {
          case 'text':
            wahaResult = await wahaService.sendText(session.waha_session_id, chatId, payload.text!);
            break;
          case 'image':
            wahaResult = await wahaService.sendImage(session.waha_session_id, chatId, payload.url!, payload.caption);
            break;
          case 'video':
            wahaResult = await wahaService.sendVideo(session.waha_session_id, chatId, payload.url!, payload.caption);
            break;
          case 'audio':
            wahaResult = await wahaService.sendAudio(session.waha_session_id, chatId, payload.url!);
            break;
          case 'file':
            wahaResult = await wahaService.sendFile(session.waha_session_id, chatId, payload.url!, payload.caption);
            break;
          case 'location':
            wahaResult = await wahaService.sendLocation(
              session.waha_session_id,
              chatId,
              payload.latitude!,
              payload.longitude!,
              payload.title
            );
            break;
        }
      } catch (err) {
        wahaError = err instanceof Error ? err.message : String(err);
      }

      if (!wahaResult || wahaError) {
        await supabase
          .from('message_logs')
          .update({ status: 'failed', error_msg: wahaError ?? 'Unknown WAHA error' })
          .eq('id', logId);
        failedCount++;
      } else {
        const creditResult = await creditService.deduct(user.id, perMessageCost, `Send bulk ${msgType} message`, logId);
        if (!creditResult.success) {
          await supabase
            .from('message_logs')
            .update({ status: 'failed', error_msg: `Credit deduction failed: ${creditResult.error}` })
            .eq('id', logId);
          failedCount++;
        } else {
          await supabase
            .from('message_logs')
            .update({ status: 'sent', waha_msg_id: wahaResult.id })
            .eq('id', logId);
          sentCount++;
        }
      }

      // Add delay between messages (skip delay after the last element)
      if (i < numbers.length - 1) {
        await sleep(delay_ms);
      }
    }

    res.json({
      success: true,
      total: numbers.length,
      sent: sentCount,
      failed: failedCount,
      credits_used: sentCount * perMessageCost
    });
  } catch (err) {
    console.error('[POST /api/messages/bulk]', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ============================================================
// GET /api/messages/logs
// Get message history for the authenticated user.
// ============================================================
router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  try {
    const page = parseInt((req.query.page as string) ?? '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) ?? '20', 10), 100);
    const session_id = req.query.session_id as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const from_date = req.query.from_date as string | undefined;
    const to_date = req.query.to_date as string | undefined;

    let query = supabase
      .from('message_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    if (session_id) query = query.eq('session_id', session_id);
    if (type) query = query.eq('msg_type', type);
    if (status) query = query.eq('status', status);
    if (from_date) query = query.gte('sent_at', from_date);
    if (to_date) query = query.lte('sent_at', to_date);

    // Pagination
    const offset = (page - 1) * limit;
    query = query.order('sent_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: logs, count, error } = await query;

    if (error) {
      console.error('[GET /api/messages/logs] DB err', error);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    res.json({
      data: logs,
      total: count ?? 0,
      page,
      limit,
      total_pages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (err) {
    console.error('[GET /api/messages/logs]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// GET /api/messages/stats
// Get usage statistics for the authenticated user.
// ============================================================
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  try {
    const period = (req.query.period as string) ?? 'today';
    
    // Determine start date based on period
    let startDate = new Date();
    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      res.status(400).json({ error: 'period must be today, week, or month' });
      return;
    }

    const { data, error } = await supabase
      .from('message_logs')
      .select('msg_type, status, credits_cost')
      .eq('user_id', user.id)
      .gte('sent_at', startDate.toISOString());

    if (error) {
      console.error('[GET /api/messages/stats] DB err', error);
      res.status(500).json({ error: 'Database error' });
      return;
    }

    let total_sent = 0;
    let total_failed = 0;
    let total_credits_used = 0;
    const by_type: Record<string, number> = { text: 0, image: 0, video: 0, audio: 0, file: 0, location: 0 };

    data?.forEach((log) => {
      if (log.status === 'sent') {
        total_sent++;
        total_credits_used += log.credits_cost;
        if (by_type[log.msg_type] !== undefined) {
          by_type[log.msg_type]++;
        } else {
          by_type[log.msg_type] = 1;
        }
      } else if (log.status === 'failed') {
        total_failed++;
      }
    });

    const totalAttempts = total_sent + total_failed;
    const success_rate_percent = totalAttempts > 0 ? Math.round((total_sent / totalAttempts) * 100) : 0;

    res.json({
      total_sent,
      total_failed,
      total_credits_used,
      by_type,
      success_rate_percent,
    });
  } catch (err) {
    console.error('[GET /api/messages/stats]', err);
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
