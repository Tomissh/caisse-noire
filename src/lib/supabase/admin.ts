// Client Supabase service-role : bypass la RLS.
//
// Usage strict : Server Actions ou Route Handlers où l'app a déjà vérifié les
// permissions. À NE JAMAIS importer depuis un Client Component (le bundler
// échouerait grâce à "server-only", mais soyons explicites).

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "./env";
import type { Database } from "./database.types";

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;
  cached = createClient<Database>(SUPABASE_URL, getServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
