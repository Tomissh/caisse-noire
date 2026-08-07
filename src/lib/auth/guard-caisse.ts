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
  cotisation_active: boolean;
  cotisation_montant_centimes: number;
  cotisation_plafonnee_par_amendes: boolean;
  cotisation_solde_pris_en_compte: boolean;
};

export type CaisseAdminContext = {
  caisse: CaisseRow;
  role: AdminRole;
  userId: string;
  // Membre de la caisse auquel cet admin est lié (admins_caisse.membre_id),
  // ou null s'il n'est lié à aucun — permet de proposer la modification de
  // sa propre photo de profil directement depuis l'espace admin.
  membreId: string | null;
};

export async function requireCaisseAdmin(caisseId: string): Promise<CaisseAdminContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: caisse } = await supabase
    .from("caisses")
    .select(
      "id, nom, code, description, cloturee_at, createur_id, cotisation_active, cotisation_montant_centimes, cotisation_plafonnee_par_amendes, cotisation_solde_pris_en_compte",
    )
    .eq("id", caisseId)
    .maybeSingle();

  if (!caisse) notFound();

  // Vérifie super-admin + lien membre (en parallèle, quel que soit le rôle
  // final — un créateur peut aussi apparaître dans admins_caisse s'il s'est
  // lié à un membre).
  const [{ data: superAdmin }, { data: adminRow }] = await Promise.all([
    supabase.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("admins_caisse")
      .select("user_id, membre_id")
      .eq("caisse_id", caisseId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  const membreId = adminRow?.membre_id ?? null;

  if (caisse.createur_id === user.id) {
    return { caisse, role: "createur", userId: user.id, membreId };
  }
  if (superAdmin) return { caisse, role: "super_admin", userId: user.id, membreId };
  if (adminRow) return { caisse, role: "admin", userId: user.id, membreId };
  notFound();
}
