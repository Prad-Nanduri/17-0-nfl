import { createSupabaseClient } from '@perfect-season/db';

export function isAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export interface MagicLinkSender {
  send(email: string, redirectTo: string): Promise<void>;
  verify(tokenHash: string): Promise<{ email: string } | null>;
}

/** Supabase Auth magic link (spec §5.1: Supabase is the single auth provider). */
export function supabaseMagicLink(): MagicLinkSender {
  const client = createSupabaseClient();
  return {
    async send(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw new Error(error.message);
    },
    async verify(tokenHash) {
      const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      if (error || !data.user?.email) return null;
      return { email: data.user.email };
    },
  };
}

export function isPlausibleEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
