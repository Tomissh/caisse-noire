"use server";

// Server actions de l'espace super-admin.
// Toutes les actions vérifient is_super_admin via la garde serveur.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/guard-admin";

type Result = { ok: true } | { ok: false; error: string };
type CreateUserResult = { ok: true; userId: string; password: string } | { ok: false; error: string };

const uuid = z.uuid();
const email = z.email("Email invalide");

// ---------------------------------------------------------------------------
// Super-admins : ajouter / retirer
// ---------------------------------------------------------------------------

const addSchema = z.object({ email });

export async function addSuperAdminAction(input: { email: string }): Promise<Result> {
  await requireSuperAdmin();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Email invalide" };

  const admin = createAdminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const target = (usersList?.users ?? []).find(
    (u) => (u.email ?? "").toLowerCase() === parsed.data.email.toLowerCase(),
  );
  if (!target) return { ok: false, error: "Aucun compte avec cet email" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("super_admins")
    .insert({ user_id: target.id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Déjà super-admin" };
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/super/admins");
  return { ok: true };
}

const removeSchema = z.object({ userId: uuid });

export async function removeSuperAdminAction(input: { userId: string }): Promise<Result> {
  const ctx = await requireSuperAdmin();
  const parsed = removeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètre invalide" };

  if (parsed.data.userId === ctx.userId) {
    return { ok: false, error: "Vous ne pouvez pas vous retirer vous-même" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("super_admins")
    .delete()
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/super/admins");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Création d'un compte admin Supabase Auth
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email,
  password: z.string().min(8, "≥ 8 caractères").max(200),
  makeSuperAdmin: z.boolean(),
});

export async function createAdminUserAction(input: {
  email: string;
  password: string;
  makeSuperAdmin: boolean;
}): Promise<CreateUserResult> {
  await requireSuperAdmin();
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Champs invalides" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Création impossible" };
  }

  if (parsed.data.makeSuperAdmin) {
    const supabase = await createClient();
    const { error: errSa } = await supabase
      .from("super_admins")
      .insert({ user_id: data.user.id });
    if (errSa) {
      return { ok: false, error: `Compte créé mais ajout super-admin échoué : ${errSa.message}` };
    }
  }

  revalidatePath("/admin/super");
  revalidatePath("/admin/super/admins");
  return { ok: true, userId: data.user.id, password: parsed.data.password };
}

// ---------------------------------------------------------------------------
// Réouverture d'une caisse depuis l'espace super-admin
// ---------------------------------------------------------------------------

const reouvrirSchema = z.object({ caisseId: uuid });

export async function reouvrirCaisseFromSuperAction(input: {
  caisseId: string;
}): Promise<Result> {
  await requireSuperAdmin();
  const parsed = reouvrirSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Paramètre invalide" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reouvrir_caisse", {
    p_caisse_id: parsed.data.caisseId,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/super/caisses");
  return { ok: true };
}
