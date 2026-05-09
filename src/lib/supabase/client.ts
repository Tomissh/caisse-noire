// Client Supabase navigateur (Client Components).
//
// Stocke la session Supabase Auth dans les cookies via @supabase/ssr.
// Pour la session membre (JWT custom), utiliser createMembreClient avec
// le token reçu de l'Edge Function login-membre.

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Client Supabase pour un membre authentifié via Edge Function login-membre.
 * Le token reçu est passé en Authorization sur chaque requête. Pas de cookie,
 * pas de refresh automatique : la session expire à `exp` du JWT.
 */
export function createMembreClient(accessToken: string) {
  return createRawClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
