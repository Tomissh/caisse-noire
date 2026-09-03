"use client";

// Section "Packs" du dashboard admin — compteur simple par membre, +1/-1
// en un clic, aucune saisie. Voir _actions.ts (ajouterPackAction /
// retirerPackAction) et supabase/migrations/20260903120000_packs.sql.

import { useTransition } from "react";
import { toast } from "sonner";
import { ajouterPackAction, retirerPackAction } from "../_actions";

export type PackRow = {
  membreId: string;
  nom: string;
  count: number;
};

export function PacksSection({ caisseId, rows }: { caisseId: string; rows: PackRow[] }) {
  const [isPending, startTransition] = useTransition();

  const handle = (membreId: string, action: "ajouter" | "retirer") => {
    startTransition(async () => {
      const res =
        action === "ajouter"
          ? await ajouterPackAction({ caisseId, membreId })
          : await retirerPackAction({ caisseId, membreId });
      if (!res.ok) toast.error(res.error);
    });
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Aucun membre.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[320px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-3 py-2">Membre</th>
            <th className="px-3 py-2 text-right">Packs</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.membreId}
              className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
            >
              <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">{r.nom}</td>
              <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-50">
                {r.count}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={isPending || r.count <= 0}
                    onClick={() => handle(r.membreId, "retirer")}
                    aria-label={`Retirer un pack à ${r.nom}`}
                    className="h-7 w-7 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handle(r.membreId, "ajouter")}
                    aria-label={`Ajouter un pack à ${r.nom}`}
                    className="h-7 w-7 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
