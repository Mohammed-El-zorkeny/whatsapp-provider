import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// ============================================================
// Supabase admin client (service_role)
// - Bypasses all RLS policies
// - Used exclusively by the Express backend — never exposed to clients
// - Single instance shared across the entire app (singleton)
// ============================================================
export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      // Disable auto session refresh — not needed for service_role usage
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
