// Helper serveur : vérifie l'accès admin à une caisse donnée et renvoie
// la caisse + le rôle effectif (createur / admin / super_admin).
//
// notFound() en cas d'absence d'accès plutôt que 403, pour ne pas laisser
// deviner l'existence de la caisse.

import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AdminRole } from "./roles";

export type CaisseRow = {
  id: string;
  nom: string;
  code: string;
  description: string | null;
  cloturee_at: string | null;
  createur_id: string;
};

export type CaisseAdminContext = {
  caisse: CaisseRow;
  role: AdminRole;
  userId: string;
};

export async function requireCaisseAdmin(caisseId: string): Promise<CaisseAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: caisse } = await supabase
    .from("caisses")
    .select("id, nom, code, description, cloturee_at, createur_id")
    .eq("id", caisseId)
    .maybeSingle();

  if (!caisse) notFound();

  if (caisse.createur_id === user.id) {
    return { caisse, role: "createur", userId: user.id };
  }

  // Vérifie super-admin (très rare cas, en parallèle de admins_caisse)
  const [{ data: superAdmin }, { data: adminRow }] = await Promise.all([
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("admins_caisse")
      .select("user_id")
      .eq("caisse_id", caisseId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (superAdmin) return { caisse, role: "super_admin", userId: user.id };
  if (adminRow) return { caisse, role: "admin", userId: user.id };
  notFound();
}
