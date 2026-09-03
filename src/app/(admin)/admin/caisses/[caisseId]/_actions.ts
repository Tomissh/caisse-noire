"use server";

// Server Actions des packs — compteur simple par membre (ajout/retrait),
// aucun montant, ledger immuable (delta +1/-1). Voir
// supabase/migrations/20260903120000_packs.sql.

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
