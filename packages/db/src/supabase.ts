import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

// Anon/public client — safe for RLS-scoped access (docs/spec.md §5.1)
export function createSupabaseClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'));
}

// Service-role client — server-side only, bypasses RLS
export function createSupabaseServiceClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
}
