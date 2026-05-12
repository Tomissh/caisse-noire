// Liste des membres d'une caisse + bouton d'ajout.
// Tri : actifs d'abord, puis par nom.

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";

export default async function MembresPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  await requireCaisseAdmin(caisseId);

  const supabase = await createClient();
  const { data: membres } = await supabase
    .from("membres")
    .select("id, prenom, nom, actif, created_at")
    .eq("caisse_id", caisseId)
    .order("actif", { ascending: false })
    .order("nom")
    .order("prenom");

  const list = membres ?? [];

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Membres
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {list.length} membre{list.length > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href={`/admin/caisses/${caisseId}/membres/new`}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + Ajouter un membre
          </Link>
        </header>

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucun membre pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {list.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {m.prenom} {m.nom}
                  </span>
                  {!m.actif && (
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      désactivé
                    </span>
                  )}
                </div>
                <Link
                  href={`/admin/caisses/${caisseId}/membres/${m.id}/edit`}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Modifier
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
