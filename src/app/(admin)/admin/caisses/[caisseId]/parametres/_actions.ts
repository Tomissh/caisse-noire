"use server";

// Server Actions de l'écran Paramètres d'une caisse :
//   - updateCaisseAction : modifie nom / description
//   - regenerateCodeAction : génère un nouveau code unique
//   - addAdminAction : ajoute un admin par email (lookup auth.users via service-role)
//   - removeAdminAction : retire un admin
//
// Pas de clôture/réouverture en 4.A — Phase 4.D.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateCaisseCode, generatePassword } from "@/lib/caisse-code";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";

const uuid = z.uuid();

const updateCaisseSchema = z.object({
  caisseId: uuid,
  nom: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});

type Result = { ok: true } | { ok: false; error: string };
type RegenResult = { ok: true; code: string } | { ok: false; error: string };

export async function updateCaisseAction(input: {
  caisseId: string;
  nom: string;
  description?: string;
}): Promise<Result> {
  const parsed = updateCaisseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Champs invalides" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("caisses")
    .update({ nom: parsed.data.nom, description: parsed.data.description })
    .eq("id", parsed.data.caisseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}`, "layout");
  return { ok: true };
}

export async function regenerateCodeAction(input: { caisseId: string }): Promise<RegenResult> {
  const parsed = z.object({ caisseId: uuid }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Identifiant invalide" };

  const supabase = await createClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCaisseCode(8);
    const { error } = await supabase
      .from("caisses")
      .update({ code })
      .eq("id", parsed.data.caisseId);
    if (!error) {
      revalidatePath(`/admin/caisses/${parsed.data.caisseId}`, "layout");
      return { ok: true, code };
    }
    if (error.code === "23505") continue;
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Impossible de générer un code unique" };
}

const addAdminSchema = z.object({
  caisseId: uuid,
  email: z.email("Email invalide"),
});

type AddAdminResult = { ok: true; password?: string } | { ok: false; error: string };

// Ajoute un admin à la caisse par email. Si aucun compte n'existe pour cet
// email, en crée un à la volée (mot de passe généré, renvoyé une seule fois
// à l'appelant pour transmission) — évite le détour obligatoire par
// l'espace super-admin pour un simple créateur qui veut ajouter un co-admin.
export async function addAdminAction(input: {
  caisseId: string;
  email: string;
}): Promise<AddAdminResult> {
  const parsed = addAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email invalide" };

  // Vérifie explicitement le rôle avant toute action service-role
  // (createUser bypasse la RLS — ne pas se reposer uniquement dessus).
  const ctx = await requireCaisseAdmin(parsed.data.caisseId);
  if (ctx.role !== "createur" && ctx.role !== "super_admin") {
    return { ok: false, error: "Seul le créateur peut ajouter un administrateur" };
  }

  // Lookup auth.users via service-role (RLS ne s'applique pas)
  const admin = createAdminClient();
  // listUsers est paginé ; on filtre côté Node sur les premières pages
  const { data, error: errList } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (errList) return { ok: false, error: errList.message };
  let target = data.users.find(
    (u) => (u.email ?? "").toLowerCase() === parsed.data.email.toLowerCase(),
  );

  let password: string | undefined;
  if (!target) {
    password = generatePassword(16);
    const { data: createdUser, error: errCreate } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password,
      email_confirm: true,
    });
    if (errCreate || !createdUser.user) {
      return { ok: false, error: errCreate?.message ?? "Création du compte impossible" };
    }
    target = createdUser.user;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admins_caisse")
    .insert({ caisse_id: parsed.data.caisseId, user_id: target.id });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Cet utilisateur est déjà admin" };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/parametres`);
  return password ? { ok: true, password } : { ok: true };
}

const removeAdminSchema = z.object({ caisseId: uuid, userId: uuid });

export async function removeAdminAction(input: {
  caisseId: string;
  userId: string;
}): Promise<Result> {
  const parsed = removeAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("admins_caisse")
    .delete()
    .eq("caisse_id", parsed.data.caisseId)
    .eq("user_id", parsed.data.userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}/parametres`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clôture / réouverture
// ---------------------------------------------------------------------------

const cloturerSchema = z.object({
  caisseId: uuid,
  confirmationNom: z.string().trim().min(1),
});

export async function cloturerCaisseAction(input: {
  caisseId: string;
  confirmationNom: string;
}): Promise<Result> {
  const parsed = cloturerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

  // Vérifie que le nom retapé correspond bien à la caisse en cours
  const ctx = await requireCaisseAdmin(parsed.data.caisseId);
  if (ctx.caisse.cloturee_at) {
    return { ok: false, error: "La caisse est déjà clôturée" };
  }
  if (parsed.data.confirmationNom !== ctx.caisse.nom) {
    return { ok: false, error: "Le nom retapé ne correspond pas à la caisse" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cloturer_caisse", {
    p_caisse_id: parsed.data.caisseId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}`, "layout");
  return { ok: true };
}

const reouvrirSchema = z.object({ caisseId: uuid });

export async function reouvrirCaisseAction(input: {
  caisseId: string;
}): Promise<Result> {
  const parsed = reouvrirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètres invalides" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reouvrir_caisse", {
    p_caisse_id: parsed.data.caisseId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/caisses/${parsed.data.caisseId}`, "layout");
  return { ok: true };
}
