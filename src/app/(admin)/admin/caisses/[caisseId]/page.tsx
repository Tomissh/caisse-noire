// Dashboard d'une caisse (Phase 4.A : placeholder, sera enrichi en 4.C avec
// soldes, totaux et dernières écritures).

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";

export default async function CaisseDashboardPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const { caisse } = await requireCaisseAdmin(caisseId);

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {caisse.nom}
          </h1>
          {caisse.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{caisse.description}</p>
          )}
        </header>

        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Soldes, totaux et dernières écritures arriveront en Phase 4.C.
          <br />
          En attendant :
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/admin/caisses/${caisseId}/membres`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Gérer les membres
            </Link>
            <Link
              href={`/admin/caisses/${caisseId}/parametres`}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Paramètres
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
