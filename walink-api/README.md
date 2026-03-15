# walink-api

> **Phase 2** — Express API Gateway for the WaLink WhatsApp SaaS platform.  
> Handles authentication, rate limiting, credit management, and WAHA message dispatch.

---

## Architecture

```
Client Request
    │
    ▼
apiKeyAuth          ← validate x-api-key → Supabase RPC (indexed lookup)
    │
    ▼
rateLimiter         ← per-user sliding window via Upstash Redis
    │
    ▼
creditCheck         ← pre-flight balance check (messages only)
    │
    ▼
Route Handler       ← business logic
    │
    ├── Supabase    ← DB reads/writes (service_role, bypasses RLS)
    └── WAHA API    ← WhatsApp message dispatch (Docker, NOWEB engine)
```

---

## Folder Structure

```
walink-api/
├── src/
│   ├── config/
│   │   ├── env.ts              ← Zod-validated env vars (fails fast at startup)
│   │   └── supabase.ts         ← Singleton Supabase admin client (service_role)
│   ├── middleware/
│   │   ├── apiKeyAuth.ts       ← x-api-key validation via get_user_by_api_key RPC
│   │   ├── creditCheck.ts      ← pre-flight credit check, attaches cost to req
│   │   ├── rateLimiter.ts      ← Upstash sliding window, plan-specific limit
│   │   └── requestLogger.ts    ← method/path/status/duration/userId logger
│   ├── routers/
│   │   ├── sessions.router.ts  ← CRUD for WhatsApp sessions
│   │   ├── messages.router.ts  ← Send messages (text/image/video/audio/file/location)
│   │   └── webhook.router.ts   ← Receive WAHA events (no auth)
│   ├── services/
│   │   ├── waha.service.ts     ← All WAHA HTTP calls via Axios
│   │   ├── credit.service.ts   ← deduct_credits / add_credits RPC wrappers
│   │   └── webhook.service.ts  ← HMAC-signed fan-out to user webhook URLs
│   ├── types/
│   │   └── index.ts            ← UserContext, MessageType, CREDIT_COSTS
│   └── app.ts                  ← Express app (middleware + routes)
├── index.ts                    ← Entry point
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Prerequisites

- Node.js ≥ 20
- WAHA running on Docker (NOWEB engine)
- Supabase project with Phase 1 migrations applied
- Upstash Redis account (free tier works)

---

## Installation

```bash
# Clone the repo
git clone <your-repo-url> walink-api
cd walink-api

# Install dependencies
npm install
```

---

## Environment Setup

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `PORT` | Express server port (default: `3001`) |
| `NODE_ENV` | `development` or `production` |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS (backend only) |
| `WAHA_BASE_URL` | WAHA Docker container URL (e.g. `http://localhost:3000`) |
| `WAHA_API_KEY` | WAHA API key (set in WAHA config) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `WEBHOOK_SECRET_SALT` | Random string for HMAC signing |

---

## Running Locally

```bash
# Development (hot reload via tsx watch)
npm run dev

# Production build
npm run build
npm start
```

---

## API Endpoints

### Sessions — `/api/sessions`

> Requires `x-api-key` header on all endpoints.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions for authenticated user |
| `POST` | `/api/sessions` | Create + start a new WhatsApp session |
| `GET` | `/api/sessions/:id/qr` | Get QR code image for scanning |
| `GET` | `/api/sessions/:id/status` | Get live status (synced from WAHA) |
| `DELETE` | `/api/sessions/:id` | Stop WAHA session and remove from DB |

**POST `/api/sessions` body:**
```json
{ "session_name": "my-whatsapp" }
```

---

### Messages — `/api/messages`

> Requires `x-api-key` header.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/messages/send` | Send a WhatsApp message |

**POST `/api/messages/send` body:**
```json
{
  "session_id": "uuid",
  "to": "201012345678",
  "type": "text",
  "text": "Hello from WaLink!"
}
```

**Sending media:**
```json
{
  "session_id": "uuid",
  "to": "201012345678",
  "type": "image",
  "url": "https://example.com/image.jpg",
  "caption": "Check this out!"
}
```

**Sending location:**
```json
{
  "session_id": "uuid",
  "to": "201012345678",
  "type": "location",
  "latitude": 30.0444,
  "longitude": 31.2357,
  "title": "Cairo, Egypt"
}
```

**Response:**
```json
{
  "success": true,
  "message_id": "uuid",
  "waha_message_id": "true_201012345678@c.us_...",
  "credits_used": 1,
  "credits_remaining": 49
}
```

---

### Webhooks — `/webhook`

> No auth — called internally by WAHA.

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/waha` | Receive events from WAHA container |

---

### Health Check

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Returns `{ status: "ok", ts: "..." }` |

---

## Credit Costs

| Message Type | Credits |
|---|---|
| `text` | 1 |
| `location` | 1 |
| `image` | 3 |
| `video` | 3 |
| `audio` | 3 |
| `file` | 3 |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Pending log before WAHA call** | Ensures a message record always exists even if the process crashes mid-send |
| **Credits deducted AFTER WAHA success** | Users are never charged for failed messages |
| **FOR UPDATE in deduct_credits RPC** | Prevents race conditions from two concurrent requests both passing the balance check |
| **WAHA session ID = `{userId.slice(0,8)}_{sessionName}`** | Prevents cross-user collisions in a shared WAHA instance |
| **Webhook route has no apiKeyAuth** | It's called by WAHA Docker internally — protect at network level instead |
| **Respond 200 immediately in webhook handler** | Prevents WAHA retries; processing happens async |
| **Auto-disable webhooks after 10 failures** | Prevents hammering dead endpoints |

---

## Rate Limiting

Per-user sliding window (1 minute) via Upstash Redis.
Limits are plan-specific:

| Plan | Requests/min |
|---|---|
| Free | 5 |
| Starter | 20 |
| Pro | 60 |
| Business | 120 |

Headers returned on every request:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## What's Next

**Phase 3 — `walink-dashboard`** (Next.js 15)
- Sign up / sign in (Supabase Auth)
- Dashboard: credit balance, session list, message stats
- QR scan flow for connecting WhatsApp
- API key management
- Webhook configuration
- Pricing & billing (Paymob / Stripe)
