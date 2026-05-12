// Tableau de bord admin : liste des caisses où l'utilisateur a un rôle.
// Données déjà chargées par le layout via requireAdminUser().

import { requireAdminUser } from "@/lib/auth/guard-admin";

export default async function AdminHomePage() {
  const { caissesAdmin } = await requireAdminUser();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Vos caisses
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Les caisses dont vous êtes créateur ou administrateur.
        </p>
      </header>

      {caissesAdmin.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Vous n&apos;êtes administrateur d&apos;aucune caisse pour le moment.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {caissesAdmin.map((c) => (
            <li
              key={c.caisse_id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">{c.nom}</div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    code : {c.code}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
