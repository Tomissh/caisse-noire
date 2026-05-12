import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { MotifForm } from "../../_form";
import { centimesToEuros } from "@/lib/format";

export default async function EditMotifPage({
  params,
}: {
  params: Promise<{ caisseId: string; motifId: string }>;
}) {
  const { caisseId, motifId } = await params;
  await requireCaisseAdmin(caisseId);

  const supabase = await createClient();
  const { data: motif } = await supabase
    .from("motifs_amende")
    .select("id, libelle, montant_centimes, montant_variable, actif")
    .eq("id", motifId)
    .eq("caisse_id", caisseId)
    .maybeSingle();
  if (!motif) notFound();

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/motifs`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Motifs
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {motif.libelle}
          </h1>
        </header>
        <MotifForm
          caisseId={caisseId}
          mode="edit"
          initial={{
            motifId: motif.id,
            libelle: motif.libelle,
            montantEuros: centimesToEuros(motif.montant_centimes),
            montantVariable: motif.montant_variable,
            actif: motif.actif,
          }}
        />
      </div>
    </main>
  );
}
