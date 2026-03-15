import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client using service_role key.
 * Bypasses RLS — use only in server components / server actions.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
