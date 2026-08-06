"use server";

// Server Actions pour la gestion des membres d'une caisse.
//   - createMembreAction : INSERT + hash bcryptjs cost 12 (cohérent avec
//     l'Edge Function set-password-membre)
//   - updateMembreAction : nom, actif
//   - resetMembrePasswordAction : remplace le password_hash (admin pose
//     directement un nouveau mdp, à transmettre au membre)
//
// La RLS sur `membres` autorise INSERT/UPDATE pour admin/créateur/super-admin
// sur caisse ouverte ; les server actions ne re-vérifient pas ces conditions
// (la couche RLS bloque côté DB en cas d'incohérence).

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const BCRYPT_COST = 12;
const PASSWORD_MIN_LENGTH = 6;

const uuid = z.uuid();
const personName = z.string().trim().min(1).max(60);
const password = z.string().min(PASSWORD_MIN_LENGTH).max(100);

type Result = { ok: true } | { ok: false; error: string };

const createMembreSchema = z.object({
  caisseId: uuid,
  nom: personName,
  password,
});

export async function createMembreAction(input: {
  caisseId: string;
  nom: string;
  password: string;
}): Promise<Result> {
  const parsed = createMembreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides" };

  const supabase = await createClient();
  const hash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);

  const { error } = await supabase.from("membres").insert({
    caisse_id: parsed.data.caisseId,
    nom: parsed.data.nom,
    password_hash: hash,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Un membre avec ce nom existe déjà dans la caisse" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/membres`);
  return { ok: true };
}

const updateMembreSchema = z.object({
  membreId: uuid,
  caisseId: uuid,
  nom: personName,
  actif: z.boolean(),
});

export async function updateMembreAction(input: {
  membreId: string;
  caisseId: string;
  nom: string;
  actif: boolean;
}): Promise<Result> {
  const parsed = updateMembreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("membres")
    .update({
      nom: parsed.data.nom,
      actif: parsed.data.actif,
    })
    .eq("id", parsed.data.membreId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Un membre avec ce nom existe déjà" };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/membres`);
  return { ok: true };
}

const resetPasswordSchema = z.object({
  membreId: uuid,
  caisseId: uuid,
  password,
});

export async function resetMembrePasswordAction(input: {
  membreId: string;
  caisseId: string;
  password: string;
}): Promise<Result> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Mot de passe invalide" };

  const supabase = await createClient();
  const hash = await bcrypt.hash(parsed.data.password, BCRYPT_COST);

  const { error } = await supabase
    .from("membres")
    .update({ password_hash: hash })
    .eq("id", parsed.data.membreId);

  if (error) return { ok: false, error: error.message };

  // L'INSERT dans audit_log est désormais émis automatiquement par le trigger
  // membres_audit (migration 20260512173000) avec action 'membre.set_password'.

  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/membres`);
  return { ok: true };
}
