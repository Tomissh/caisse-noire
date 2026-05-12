"use server";

// Server Actions des écritures (amendes / paiements / retraits) + soft-delete.
//
// - declareAmendeAction : 1 ou N membres en une seule transaction (insert batch).
//   Le `motif_id` peut être null (saisie libre). Le libellé est toujours stocké
//   (copie du catalogue pour conservation après suppression du motif).
// - recordPaiementAction : montant positif uniquement, moyen ∈ enum.
// - recordRetraitAction : montant euros signé (positif = sortie, négatif =
//   correction). 0 interdit.
// - supprimerAmendeAction / supprimerPaiementAction : appel RPC qui valide
//   motif ≥ 5 chars et soft-delete.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { eurosToCentimes } from "@/lib/format";

const uuid = z.uuid();
const motifText = z.string().trim().min(5, "Motif requis (≥ 5 caractères)").max(500);

type Result = { ok: true; count?: number } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Amendes
// ---------------------------------------------------------------------------

const declareAmendeSchema = z
  .object({
    caisseId: uuid,
    motifId: uuid.nullable(),
    libelle: z.string().trim().min(1, "Libellé requis").max(120),
    montantEuros: z.number().int().positive().max(10_000),
    membreIds: z.array(uuid).min(1, "Sélectionnez au moins un membre"),
  })
  .strict();

export async function declareAmendeAction(input: {
  caisseId: string;
  motifId: string | null;
  libelle: string;
  montantEuros: number;
  membreIds: string[];
}): Promise<Result> {
  const parsed = declareAmendeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const centimes = eurosToCentimes(parsed.data.montantEuros);
  const rows = parsed.data.membreIds.map((membreId) => ({
    caisse_id: parsed.data.caisseId,
    membre_id: membreId,
    motif_id: parsed.data.motifId,
    libelle: parsed.data.libelle,
    montant_centimes: centimes,
    declaree_par_user_id: user.id,
  }));

  const { error, count } = await supabase
    .from("amendes")
    .insert(rows, { count: "exact" });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/ecritures`);
  return { ok: true, count: count ?? rows.length };
}

const supprimerAmendeSchema = z.object({
  caisseId: uuid,
  amendeId: uuid,
  motif: motifText,
});

export async function supprimerAmendeAction(input: {
  caisseId: string;
  amendeId: string;
  motif: string;
}): Promise<Result> {
  const parsed = supprimerAmendeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_amende", {
    p_amende_id: parsed.data.amendeId,
    p_motif: parsed.data.motif,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/ecritures`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

const moyenPaiement = z.enum(["especes", "virement", "autre"]);

const recordPaiementSchema = z.object({
  caisseId: uuid,
  membreId: uuid,
  montantEuros: z.number().int().positive().max(10_000),
  moyen: moyenPaiement,
});

export async function recordPaiementAction(input: {
  caisseId: string;
  membreId: string;
  montantEuros: number;
  moyen: "especes" | "virement" | "autre";
}): Promise<Result> {
  const parsed = recordPaiementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const { error } = await supabase.from("paiements").insert({
    caisse_id: parsed.data.caisseId,
    membre_id: parsed.data.membreId,
    montant_centimes: eurosToCentimes(parsed.data.montantEuros),
    moyen: parsed.data.moyen,
    enregistre_par_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/ecritures`);
  return { ok: true };
}

const supprimerPaiementSchema = z.object({
  caisseId: uuid,
  paiementId: uuid,
  motif: motifText,
});

export async function supprimerPaiementAction(input: {
  caisseId: string;
  paiementId: string;
  motif: string;
}): Promise<Result> {
  const parsed = supprimerPaiementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_paiement", {
    p_paiement_id: parsed.data.paiementId,
    p_motif: parsed.data.motif,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/ecritures`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Retraits (immuables, signe libre, 0 interdit)
// ---------------------------------------------------------------------------

const recordRetraitSchema = z.object({
  caisseId: uuid,
  libelle: z.string().trim().min(1, "Libellé requis").max(200),
  montantEuros: z
    .number()
    .int("Euros entiers uniquement")
    .refine((n) => n !== 0, "Le montant ne peut pas être 0")
    .refine((n) => Math.abs(n) <= 100_000, "Montant trop grand"),
});

export async function recordRetraitAction(input: {
  caisseId: string;
  libelle: string;
  montantEuros: number;
}): Promise<Result> {
  const parsed = recordRetraitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  const { error } = await supabase.from("retraits").insert({
    caisse_id: parsed.data.caisseId,
    libelle: parsed.data.libelle,
    montant_centimes: eurosToCentimes(parsed.data.montantEuros),
    enregistre_par_user_id: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/ecritures`);
  return { ok: true };
}
