"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuditFilterBar({
  actions,
  action,
  from,
  to,
  acteur,
}: {
  actions: { value: string; label: string }[];
  action: string | null;
  from: string | null;
  to: string | null;
  acteur: string | null;
}) {
  const router = useRouter();
  const [actionV, setActionV] = useState(action ?? "");
  const [fromV, setFromV] = useState(from ?? "");
  const [toV, setToV] = useState(to ?? "");
  const [acteurV, setActeurV] = useState(acteur ?? "");

  const apply = () => {
    const params = new URLSearchParams();
    if (actionV) params.set("action", actionV);
    if (fromV) params.set("from", fromV);
    if (toV) params.set("to", toV);
    if (acteurV) params.set("acteur", acteurV);
    router.push(`?${params.toString()}`);
  };

  const reset = () => {
    setActionV("");
    setFromV("");
    setToV("");
    setActeurV("");
    router.push("?");
  };

  return (
    <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1 lg:col-span-2">
        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Action</label>
        <select
          value={actionV}
          onChange={(e) => setActionV(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        >
          {actions.map((a) => (
            <option key={a.value || "all"} value={a.value}>
              {a.label}
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

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">Acteur</label>
        <input
          type="text"
          value={acteurV}
          onChange={(e) => setActeurV(e.target.value)}
          placeholder="email ou nom"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
        <button
          type="button"
          onClick={apply}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
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
