// Saisie d'une amende. Précharge la liste des motifs actifs et des membres
// actifs pour les passer au formulaire client.

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { centimesToEuros } from "@/lib/format";
import { AmendeForm } from "./_form";

export default async function NewAmendePage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);
  if (ctx.caisse.cloturee_at) {
    redirect(`/admin/caisses/${caisseId}/ecritures`);
  }

  const supabase = await createClient();
  const [motifsRes, membresRes] = await Promise.all([
    supabase
      .from("motifs_amende")
      .select("id, libelle, montant_centimes, montant_variable")
      .eq("caisse_id", caisseId)
      .eq("actif", true)
      .order("libelle"),
    supabase
      .from("membres")
      .select("id, nom")
      .eq("caisse_id", caisseId)
      .eq("actif", true)
      .order("nom"),
  ]);

  const motifs = (motifsRes.data ?? []).map((m) => ({
    id: m.id,
    libelle: m.libelle,
    montantEuros: centimesToEuros(m.montant_centimes),
    montantVariable: m.montant_variable,
  }));
  const membres = membresRes.data ?? [];

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/ecritures`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Écritures
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nouvelle amende
          </h1>
        </header>
        {membres.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucun membre actif. Ajoutez d&apos;abord un membre.
          </div>
        ) : (
          <AmendeForm caisseId={caisseId} motifs={motifs} membres={membres} />
        )}
      </div>
    </main>
  );
}
