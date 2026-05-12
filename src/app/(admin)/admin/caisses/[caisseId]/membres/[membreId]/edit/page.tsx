// Édition d'un membre : prénom, nom, actif/désactivé + reset password.
// Le mdp actuel n'est jamais affiché (seul son hash est stocké) ; pour le
// changer l'admin saisit un nouveau mdp (ou en génère un).

import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { EditMembreForm } from "./_form";

export default async function EditMembrePage({
  params,
}: {
  params: Promise<{ caisseId: string; membreId: string }>;
}) {
  const { caisseId, membreId } = await params;
  await requireCaisseAdmin(caisseId);

  const supabase = await createClient();
  const { data: membre } = await supabase
    .from("membres")
    .select("id, prenom, nom, actif")
    .eq("id", membreId)
    .eq("caisse_id", caisseId)
    .maybeSingle();
  if (!membre) notFound();

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/membres`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Membres
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {membre.prenom} {membre.nom}
          </h1>
        </header>
        <EditMembreForm caisseId={caisseId} membre={membre} />
      </div>
    </main>
  );
}
