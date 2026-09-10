"use server";

// Server Actions des packs — compteur simple par membre (ajout/retrait),
// aucun montant, ledger immuable (delta +1/-1). Voir
// supabase/migrations/20260903120000_packs.sql.
//
// genererCotisationMoisAction : déclenchement manuel de la cotisation
// mensuelle, y compris pour le mois en cours (pas de cron — voir
// 20260910170000_cotisation_manuelle.sql et
// 20260910180000_cotisation_mois_en_cours.sql). La RPC
// generer_cotisations_mois vérifie elle-même l'autorisation (is_admin_of +
// caisse ouverte) et reste idempotente (une seule génération par mois).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const packSchema = z.object({
  caisseId: z.uuid(),
  membreId: z.uuid(),
});

async function recordPackMouvement(
  input: { caisseId: string; membreId: string },
  delta: 1 | -1,
): Promise<Result> {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const { error } = await supabase.from("packs_mouvements").insert({
    caisse_id: parsed.data.caisseId,
    membre_id: parsed.data.membreId,
    delta,
    enregistre_par_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}`);
  return { ok: true };
}

export async function ajouterPackAction(input: {
  caisseId: string;
  membreId: string;
}): Promise<Result> {
  return recordPackMouvement(input, 1);
}

export async function retirerPackAction(input: {
  caisseId: string;
  membreId: string;
}): Promise<Result> {
  return recordPackMouvement(input, -1);
}

const genererCotisationSchema = z.object({
  caisseId: z.uuid(),
  mois: z.string().regex(/^\d{4}-\d{2}$/, "Mois invalide (YYYY-MM)"),
});

export async function genererCotisationMoisAction(input: {
  caisseId: string;
  mois: string; // "YYYY-MM"
}): Promise<Result & { count?: number }> {
  const parsed = genererCotisationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const { data, error } = await supabase.rpc("generer_cotisations_mois", {
    p_caisse_id: parsed.data.caisseId,
    p_mois: `${parsed.data.mois}-01`,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/caisses/${parsed.data.caisseId}`);
  return { ok: true, count: data ?? 0 };
}
