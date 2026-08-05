// Tableau de bord admin : liste des caisses où l'utilisateur a un rôle.
// Données chargées par requireAdminUser() (le layout le fait aussi mais le
// re-render est mis en cache donc l'appel est gratuit).

import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/guard-admin";
import { AdminTopbar } from "./_components/topbar";

export default async function AdminHomePage() {
  const { caissesAdmin, isSuperAdmin } = await requireAdminUser();

  return (
    <>
      <AdminTopbar isSuperAdmin={isSuperAdmin} />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Vos caisses
              </h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Les caisses dont vous êtes créateur ou administrateur.
              </p>
            </div>
            <Link
              href="/admin/caisses/new"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              + Nouvelle caisse
            </Link>
          </header>

          {caissesAdmin.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Vous n&apos;êtes administrateur d&apos;aucune caisse.
              <br />
              <Link
                href="/admin/caisses/new"
                className="mt-3 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Créer ma première caisse
              </Link>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {caissesAdmin.map((c) => (
                <li key={c.caisse_id}>
                  <Link
                    href={`/admin/caisses/${c.caisse_id}`}
                    className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-50">{c.nom}</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {c.code}
                        </div>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {c.role}
                      </span>
                    </div>
                    {c.cloturee_at && (
                      <div className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                        Caisse clôturée
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {isSuperAdmin && (
            <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Section super-admin
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Vue globale, gestion des admins et audit log — Phase 4.D.
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
