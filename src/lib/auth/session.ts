// Session Supabase Auth courante (admin), mémoïsée via React cache().
//
// requireAdminUser / requireCaisseAdmin sont tous deux appelés plusieurs
// fois par requête (layouts imbriqués + page) : sans cache(), chacun
// déclenchait son propre auth.getUser() (round-trip réseau vers Supabase
// Auth). cache() garantit un seul appel réel par requête, les suivants
// réutilisent le même résultat.

import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
