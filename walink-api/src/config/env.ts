import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================
// Zod schema — validates all required env vars at startup.
// The process will throw immediately if anything is missing,
// preventing silent runtime failures deep in request handlers.
// ============================================================
const envSchema = z.object({
  PORT: z
    .string()
    .default('3001')
    .transform((v) => parseInt(v, 10)),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Supabase (service_role bypasses RLS — backend only)
  SUPABASE_URL: z.string().url({ message: 'SUPABASE_URL must be a valid URL' }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, { message: 'SUPABASE_SERVICE_ROLE_KEY is required' }),

  // WAHA Docker instance
  WAHA_BASE_URL: z
    .string()
    .url({ message: 'WAHA_BASE_URL must be a valid URL' }),
  WAHA_API_KEY: z.string().min(1, { message: 'WAHA_API_KEY is required' }),

  // Upstash Redis for rate limiting
  UPSTASH_REDIS_REST_URL: z
    .string()
    .url({ message: 'UPSTASH_REDIS_REST_URL must be a valid URL' }),
  UPSTASH_REDIS_REST_TOKEN: z
    .string()
    .min(1, { message: 'UPSTASH_REDIS_REST_TOKEN is required' }),

  // Salt for HMAC-SHA256 webhook signatures
  WEBHOOK_SECRET_SALT: z
    .string()
    .min(8, { message: 'WEBHOOK_SECRET_SALT must be at least 8 characters' }),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Environment validation failed:');
  parsed.error.errors.forEach((e) => {
    console.error(`   ${e.path.join('.')}: ${e.message}`);
  });
  process.exit(1);
}

export const env = parsed.data;
