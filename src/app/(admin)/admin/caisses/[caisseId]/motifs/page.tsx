// Catalogue des motifs d'amende d'une caisse.
//   - Actifs en premier, désactivés grisés ensuite.
//   - Indique "fixe" / "variable" selon montant_variable.

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { formatEuros } from "@/lib/format";
import { MotifRowActions } from "./_row-actions";

export default async function MotifsPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);
  const cloturee = Boolean(ctx.caisse.cloturee_at);
  const canDelete = ctx.role === "createur" || ctx.role === "super_admin";

  const supabase = await createClient();
  const { data: motifs } = await supabase
    .from("motifs_amende")
    .select("id, libelle, montant_centimes, montant_variable, actif")
    .eq("caisse_id", caisseId)
    .order("actif", { ascending: false })
    .order("libelle");

  const list = motifs ?? [];

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Motifs d&apos;amende
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Catalogue de motifs pré-définis. À la saisie d&apos;une amende, on peut piocher
              dans ce catalogue ou saisir un motif libre.
            </p>
          </div>
          {!cloturee && (
            <Link
              href={`/admin/caisses/${caisseId}/motifs/new`}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              + Nouveau motif
            </Link>
          )}
        </header>

        {cloturee && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            La caisse est clôturée — lecture seule.
          </div>
        )}

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucun motif catalogué.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {list.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between gap-4 px-4 py-3 text-sm ${
                  m.actif ? "" : "opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{m.libelle}</span>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {formatEuros(m.montant_centimes)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      m.montant_variable
                        ? "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                        : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                    title={m.montant_variable ? "Modifiable à la saisie" : "Verrouillé à la saisie"}
                  >
                    {m.montant_variable ? "variable" : "fixe"}
                  </span>
                  {!m.actif && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      désactivé
                    </span>
                  )}
                </div>
                <MotifRowActions
                  motifId={m.id}
                  caisseId={caisseId}
                  actif={m.actif}
                  canDelete={canDelete}
                  readOnly={cloturee}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
