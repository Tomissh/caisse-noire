// Helpers serveur pour les layouts/pages (admin).
//
// requireAdminUser() : lit la session Supabase Auth, redirige vers /login si
// absente. Charge les rôles dérivés (super-admin, caisses où l'utilisateur
// est créateur ou admin) et renvoie l'état complet à injecter dans le
// AdminAuthProvider.
//
// Mémoïsé via React cache() : le layout (admin) et le layout super-admin
// imbriqué appellent tous deux ce guard pour la même requête — un seul
// aller-retour Supabase réel, le second appel réutilise le résultat.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "./session";
import type { AdminInitialState, CaisseAccess } from "./roles";

export const requireAdminUser = cache(async function requireAdminUser(): Promise<AdminInitialState> {
  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [superAdminRes, caissesCreateurRes, adminsCaisseRes] = await Promise.all([
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("caisses")
      .select("id, nom, code, cloturee_at")
      .eq("createur_id", user.id),
    supabase
      .from("admins_caisse")
      .select("caisse_id, caisses!inner(id, nom, code, cloturee_at)")
      .eq("user_id", user.id),
  ]);

  const caisses: CaisseAccess[] = [];

  for (const c of caissesCreateurRes.data ?? []) {
    caisses.push({
      caisse_id: c.id,
      nom: c.nom,
      code: c.code,
      cloturee_at: c.cloturee_at,
      role: "createur",
    });
  }
  for (const row of adminsCaisseRes.data ?? []) {
    const c = row.caisses as unknown as {
      id: string;
      nom: string;
      code: string;
      cloturee_at: string | null;
    } | null;
    if (!c) continue;
    // Évite les doublons si l'utilisateur est à la fois créateur et listé
    if (caisses.some((existing) => existing.caisse_id === c.id)) continue;
    caisses.push({
      caisse_id: c.id,
      nom: c.nom,
      code: c.code,
      cloturee_at: c.cloturee_at,
      role: "admin",
    });
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    isSuperAdmin: Boolean(superAdminRes.data),
    caissesAdmin: caisses,
  };
});

/** Garde dédiée pour les segments super-admin. */
export async function requireSuperAdmin(): Promise<AdminInitialState> {
  const state = await requireAdminUser();
  if (!state.isSuperAdmin) redirect("/admin");
  return state;
}
