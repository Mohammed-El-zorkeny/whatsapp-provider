# walink-supabase

> Database layer for **WaLink** — a WhatsApp SaaS platform that lets developers connect personal WhatsApp numbers via QR code and get a REST API for sending/receiving messages.

---

## What's in this repo

| Path | Purpose |
|---|---|
| `supabase/migrations/` | Ordered SQL migrations (run 00001 → 00009) |
| `supabase/seed.sql` | Seed data — the 4 subscription plans |
| `supabase/config.toml` | Supabase CLI project configuration |
| `.env.example` | Environment variable template |

---

## Database Schema

```
auth.users  (Supabase managed)
    │
    └── profiles          — extends auth.users; holds api_key, credits_balance, plan
            │
            ├── wa_sessions          — WAHA WhatsApp sessions (QR → CONNECTED)
            ├── credit_transactions  — immutable credit ledger
            ├── message_logs         — outbound message records
            ├── payments             — Paymob / Stripe payment records
            └── webhook_configs      — user-defined event webhook endpoints

plans  (public, no FK to users)
```

---

## Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) ≥ 1.x
- A Supabase project (cloud) **or** Docker for local dev

```bash
# Install Supabase CLI via npm
npm install -g supabase

# Or via Scoop (Windows)
scoop install supabase
```

---

## Setup — Cloud Project (Recommended)

### 1. Link your project

```bash
supabase login
supabase link --project-ref your-project-ref
```

> Find your project ref at:  
> **Supabase Dashboard → Project Settings → General → Reference ID**

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 3. Push migrations to production

```bash
supabase db push
```

This runs all files in `supabase/migrations/` in numeric order (00001 → 00009).

### 4. Seed the plans table

```bash
supabase db seed
```

Or manually:

```bash
psql "$DATABASE_URL" -f supabase/seed.sql
```

---

## Setup — Local Development

### 1. Start local Supabase stack (requires Docker)

```bash
supabase start
```

This spins up Postgres, Auth, Studio, and all Supabase services locally.

### 2. Apply migrations

```bash
supabase db reset
```

`db reset` drops and recreates the local DB, applies all migrations, then runs `seed.sql`.

### 3. Open local Studio

```
http://localhost:54323
```

---

## Migration Overview

| File | What it creates |
|---|---|
| `00001_create_plans.sql` | `plans` table — subscription tiers |
| `00002_create_profiles.sql` | `profiles` table + API key generation trigger + auto-profile-on-signup trigger |
| `00003_create_wa_sessions.sql` | `wa_sessions` table — WAHA session state |
| `00004_create_credit_transactions.sql` | `credit_transactions` table — credit ledger |
| `00005_create_message_logs.sql` | `message_logs` table + 3 performance indexes |
| `00006_create_payments.sql` | `payments` table — Paymob / Stripe records |
| `00007_create_webhook_configs.sql` | `webhook_configs` table — outbound event hooks |
| `00008_rls_policies.sql` | Row Level Security on all tables |
| `00009_rpc_functions.sql` | 4 RPC functions (see below) |

---

## RPC Functions

All functions use `SECURITY DEFINER` and are called from the **Express backend** using `SUPABASE_SERVICE_ROLE_KEY`.

| Function | Called by | Purpose |
|---|---|---|
| `deduct_credits(user_id, amount, description, ref_id?)` | Express — after each message sent | Atomically deducts credits with `FOR UPDATE` row lock |
| `add_credits(user_id, amount, type, description, ref_id?)` | Express — after payment webhook confirmed | Credits user balance and logs transaction |
| `get_user_by_api_key(api_key)` | Express — auth middleware, every request | Fast user+plan lookup via indexed api_key |
| `reset_monthly_credits()` | Cron job — 1st of each month | Resets `credits_used_month` to 0 for all users |

---

## Row Level Security

| Table | Policies |
|---|---|
| `plans` | Public read (anyone can view pricing) |
| `profiles` | Owner can SELECT and UPDATE |
| `wa_sessions` | Owner full CRUD |
| `credit_transactions` | Owner SELECT only (immutable ledger) |
| `message_logs` | Owner SELECT only (written by backend) |
| `payments` | Owner SELECT only (written by payment webhook) |
| `webhook_configs` | Owner full CRUD |

> **Note:** The Express backend uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS entirely. RLS only applies to frontend (Next.js) requests using the `anon` or `user JWT` key.

---

## Subscription Plans

| Plan | Price | Monthly Credits | Sessions | Files | Webhooks | Rate Limit | Support |
|---|---|---|---|---|---|---|---|
| Free | $0 | 50 | 1 | ✗ | ✗ | 5/min | Community |
| Starter | $9/mo | 1,000 | 1 | ✓ | ✓ | 20/min | Email |
| Pro | $25/mo | 5,000 | 3 | ✓ | ✓ | 60/min | Priority |
| Business | $60/mo | 20,000 | 10 | ✓ | ✓ | 120/min | Dedicated |

---

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `SUPABASE_URL` | Frontend + Backend | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Frontend (Next.js) | Public key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (Express) only | Secret key — bypasses RLS, **never expose to frontend** |

---

## What's Next

**Phase 2 — `walink-api`** (Node.js Express Gateway)

- Auth middleware calls `get_user_by_api_key` RPC on every request
- Routes: `/send/text`, `/send/image`, `/send/file`, `/sessions`, `/webhooks`
- WAHA integration for QR code generation and session management
- Paymob + Stripe payment webhook handlers calling `add_credits`
- Rate limiting per plan using `rate_limit_per_min`

---

## License

MIT
