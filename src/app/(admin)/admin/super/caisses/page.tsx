// Liste de toutes les caisses (vue super-admin).
//   - Affiche créateur (email), date de création, statut, code.
//   - Bouton "Ouvrir" → /admin/caisses/[id]
//   - Bouton "Réouvrir" si clôturée.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReouvrirButton } from "./_reouvrir-button";

export default async function AllCaissesPage() {
  const supabase = await createClient();
  const { data: caisses } = await supabase
    .from("caisses")
    .select("id, nom, code, createur_id, cloturee_at, created_at")
    .order("created_at", { ascending: false });

  const list = caisses ?? [];

  // Email des créateurs
  const userIds = new Set<string>(list.map((c) => c.createur_id));
  const emailsById = new Map<string, string>();
  if (userIds.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email && userIds.has(u.id)) emailsById.set(u.id, u.email);
    }
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Toutes les caisses
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {list.length} caisse{list.length > 1 ? "s" : ""} au total.
          </p>
        </header>

        {list.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucune caisse.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {list.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{c.nom}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-mono">{c.code}</span>
                    <span className="mx-2">·</span>
                    créée par {emailsById.get(c.createur_id) ?? c.createur_id.slice(0, 8)}
                    <span className="mx-2">·</span>
                    {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </div>
                </div>
                {c.cloturee_at ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                    clôturée
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                    ouverte
                  </span>
                )}
                <Link
                  href={`/admin/caisses/${c.id}`}
                  className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Ouvrir
                </Link>
                {c.cloturee_at && <ReouvrirButton caisseId={c.id} caisseNom={c.nom} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
