// Client Supabase pour Server Components, Server Actions et Route Handlers.
//
// Lit/écrit les cookies de session via next/headers. Utilise la clé anonyme
// donc soumis à la RLS.

import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component ; les cookies ne sont mutables
          // que dans une Server Action ou un Route Handler. Le middleware se
          // charge de rafraîchir la session, donc on peut ignorer ici.
        }
      },
    },
  });
}
