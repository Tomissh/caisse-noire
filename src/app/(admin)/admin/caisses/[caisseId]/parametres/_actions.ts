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
import { generateCaisseCode } from "@/lib/caisse-code";

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

export async function addAdminAction(input: {
  caisseId: string;
  email: string;
}): Promise<Result> {
  const parsed = addAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email invalide" };

  // Lookup auth.users via service-role (RLS ne s'applique pas)
  const admin = createAdminClient();
  // listUsers est paginé ; on filtre côté Node sur les premières pages
  const { data, error: errList } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (errList) return { ok: false, error: errList.message };
  const target = data.users.find(
    (u) => (u.email ?? "").toLowerCase() === parsed.data.email.toLowerCase(),
  );
  if (!target) {
    return {
      ok: false,
      error: "Aucun compte avec cet email. Demande au super-admin de le créer.",
    };
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
  return { ok: true };
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
