import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { requestLogger } from './middleware/requestLogger';
import sessionsRouter from './routers/sessions.router';
import messagesRouter from './routers/messages.router';
import { internalRouter as wahaWebhookRouter, apiRouter as webhooksApiRouter } from './routers/webhook.router';

// ============================================================
// Express Application
// ============================================================
const app = express();

// ============================================================
// Security & parsing middleware
// ============================================================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(requestLogger);

// ============================================================
// Health check — used by Docker, load balancers, uptime monitors
// ============================================================
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ============================================================
// API Routes
// ============================================================
app.use('/api/sessions',  sessionsRouter);
app.use('/api/messages',  messagesRouter);
app.use('/api/webhooks',  webhooksApiRouter);
app.use('/webhook/waha',  wahaWebhookRouter);

// ============================================================
// 404 handler — must be last
// ============================================================
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

export default app;
