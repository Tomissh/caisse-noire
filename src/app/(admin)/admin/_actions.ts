"use server";

// Server Actions du dashboard global /admin.
// Pour l'instant : création d'une caisse (génération de code unique avec retry
// en cas de collision sur l'index UNIQUE).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateCaisseCode } from "@/lib/caisse-code";

const createCaisseSchema = z.object({
  nom: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((s) => (s && s.length > 0 ? s : null)),
});

export type CreateCaisseResult =
  | { ok: true; caisseId: string; code: string }
  | { ok: false; error: string };

export async function createCaisseAction(input: {
  nom: string;
  description?: string;
}): Promise<CreateCaisseResult> {
  const parsed = createCaisseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Non authentifié" };

  // Retry sur conflit d'unicité du code (très rare avec 8 chars alphanum)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCaisseCode(8);
    const { data, error } = await supabase
      .from("caisses")
      .insert({
        nom: parsed.data.nom,
        description: parsed.data.description,
        code,
        createur_id: user.id,
      })
      .select("id")
      .single();

    if (!error && data) {
      revalidatePath("/admin");
      return { ok: true, caisseId: data.id, code };
    }
    if (error?.code === "23505") continue;
    return { ok: false, error: error?.message ?? "Erreur inconnue" };
  }
  return { ok: false, error: "Impossible de générer un code unique" };
}
