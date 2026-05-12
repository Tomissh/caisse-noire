"use server";

// Server Actions du catalogue de motifs d'amende.
//   - createMotifAction
//   - updateMotifAction
//   - toggleMotifActifAction (désactiver / réactiver)
//   - deleteMotifAction (suppression dure, réservée au créateur de la caisse)
//
// La RLS bloque les écritures si la caisse est clôturée ; les actions
// remontent l'erreur Postgres si l'admin essaie quand même.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { eurosToCentimes } from "@/lib/format";

const uuid = z.uuid();
const libelle = z.string().trim().min(1).max(120);
const montantEuros = z.number().int().positive().max(10_000);

type Result = { ok: true } | { ok: false; error: string };

const createSchema = z.object({
  caisseId: uuid,
  libelle,
  montantEuros,
  montantVariable: z.boolean(),
});

export async function createMotifAction(input: {
  caisseId: string;
  libelle: string;
  montantEuros: number;
  montantVariable: boolean;
}): Promise<Result> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides" };

  const supabase = await createClient();
  const { error } = await supabase.from("motifs_amende").insert({
    caisse_id: parsed.data.caisseId,
    libelle: parsed.data.libelle,
    montant_centimes: eurosToCentimes(parsed.data.montantEuros),
    montant_variable: parsed.data.montantVariable,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce libellé existe déjà" };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/motifs`);
  return { ok: true };
}

const updateSchema = z.object({
  motifId: uuid,
  caisseId: uuid,
  libelle,
  montantEuros,
  montantVariable: z.boolean(),
  actif: z.boolean(),
});

export async function updateMotifAction(input: {
  motifId: string;
  caisseId: string;
  libelle: string;
  montantEuros: number;
  montantVariable: boolean;
  actif: boolean;
}): Promise<Result> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("motifs_amende")
    .update({
      libelle: parsed.data.libelle,
      montant_centimes: eurosToCentimes(parsed.data.montantEuros),
      montant_variable: parsed.data.montantVariable,
      actif: parsed.data.actif,
    })
    .eq("id", parsed.data.motifId);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ce libellé existe déjà" };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/motifs`);
  return { ok: true };
}

const toggleSchema = z.object({ motifId: uuid, caisseId: uuid, actif: z.boolean() });

export async function toggleMotifActifAction(input: {
  motifId: string;
  caisseId: string;
  actif: boolean;
}): Promise<Result> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("motifs_amende")
    .update({ actif: parsed.data.actif })
    .eq("id", parsed.data.motifId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/motifs`);
  return { ok: true };
}

const deleteSchema = z.object({ motifId: uuid, caisseId: uuid });

export async function deleteMotifAction(input: {
  motifId: string;
  caisseId: string;
}): Promise<Result> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

  // Suppression dure réservée au créateur (et super-admin).
  const ctx = await requireCaisseAdmin(parsed.data.caisseId);
  if (ctx.role !== "createur" && ctx.role !== "super_admin") {
    return { ok: false, error: "Seul le créateur peut supprimer définitivement un motif" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("motifs_amende")
    .delete()
    .eq("id", parsed.data.motifId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/motifs`);
  return { ok: true };
}
