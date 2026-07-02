// Client Supabase navigateur (Client Components).
//
// Stocke la session Supabase Auth dans les cookies via @supabase/ssr.
// Pour la session membre (JWT custom), utiliser createMembreClient avec
// le token reçu de l'Edge Function login-membre.

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./database.types";

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Cache module-level (pas un useMemo React) : en StrictMode, React invoque
// deux fois la fonction de rendu au montage sans partager le cache useMemo
// entre les deux passes, donc un useMemo seul recrée quand même deux
// GoTrueClient. Un cache hors-React est nécessaire pour dédupliquer.
let cachedMembreClient: { token: string; client: SupabaseClient<Database> } | undefined;

/**
 * Client Supabase pour un membre authentifié via Edge Function login-membre.
 * Le token reçu est passé en Authorization sur chaque requête. Pas de cookie,
 * pas de refresh automatique : la session expire à `exp` du JWT.
 *
 * storageKey distinct de celui du client admin (par défaut dérivé de
 * SUPABASE_URL, donc identique) : sinon GoTrueClient détecte deux instances
 * sur la même clé et log "Multiple GoTrueClient instances detected", même
 * avec persistSession: false.
 */
export function createMembreClient(accessToken: string) {
  if (cachedMembreClient?.token === accessToken) return cachedMembreClient.client;

  const client = createRawClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      storageKey: "sb-membre-auth-token",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  cachedMembreClient = { token: accessToken, client };
  return client;
}
