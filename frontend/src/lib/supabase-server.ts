import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté serveur avec la service role key.
 * À utiliser UNIQUEMENT dans les API routes (jamais côté client).
 */
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
