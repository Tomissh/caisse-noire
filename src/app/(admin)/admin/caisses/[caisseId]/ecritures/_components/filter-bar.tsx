"use client";

// Barre de filtres : membre, période, inclure supprimées.
// On utilise un form GET qui pousse les params via router.push pour
// conserver l'URL bookmarkable.

import { useRouter } from "next/navigation";
import { useState } from "react";

export function FilterBar({
  tab,
  membres,
  membreId,
  from,
  to,
  includeDeleted,
}: {
  tab: string;
  membres: { id: string; nom: string }[];
  membreId: string | null;
  from: string | null;
  to: string | null;
  includeDeleted: boolean;
}) {
  const router = useRouter();
  const [membre, setMembre] = useState(membreId ?? "");
  const [fromV, setFromV] = useState(from ?? "");
  const [toV, setToV] = useState(to ?? "");
  const [deleted, setDeleted] = useState(includeDeleted);

  const apply = () => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (membre) params.set("membre", membre);
    if (fromV) params.set("from", fromV);
    if (toV) params.set("to", toV);
    if (deleted) params.set("deleted", "1");
    router.push(`?${params.toString()}`);
  };

  const reset = () => {
    setMembre("");
    setFromV("");
    setToV("");
    setDeleted(false);
    router.push(`?tab=${tab}`);
  };

  const isAmendes = tab === "amendes" || tab === "toutes";
  const isPaiements = tab === "paiements" || tab === "toutes";

  return (
    <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Membre</label>
        <select
          disabled={tab === "retraits"}
          value={membre}
          onChange={(e) => setMembre(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <option value="">Tous</option>
          {membres.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nom}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Du</label>
        <input
          type="date"
          value={fromV}
          onChange={(e) => setFromV(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Au</label>
        <input
          type="date"
          value={toV}
          onChange={(e) => setToV(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="flex items-end gap-2">
        {(isAmendes || isPaiements) && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              className="size-4 rounded border-zinc-300 dark:border-zinc-700"
              checked={deleted}
              onChange={(e) => setDeleted(e.target.checked)}
            />
            Inclure supprimées
          </label>
        )}
        <button
          type="button"
          onClick={apply}
          className="ml-auto rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Filtrer
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Réinitialiser
        </button>
      </div>
    </div>
  );
}
