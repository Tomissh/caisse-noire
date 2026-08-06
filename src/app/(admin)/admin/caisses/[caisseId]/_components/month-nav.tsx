"use client";

// Sélecteur de mois (récap mensuel du tableau de bord) : flèches
// précédent/suivant + input natif type="month". Pousse le mois choisi dans
// l'URL du dashboard (?mois=YYYY-MM) pour rester bookmarkable.

import { useRouter } from "next/navigation";

function shiftMonth(mois: string, delta: number): string {
  const [y, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function MonthNav({ mois, caisseId }: { mois: string; caisseId: string }) {
  const router = useRouter();

  const go = (target: string) => {
    router.push(`/admin/caisses/${caisseId}?mois=${target}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftMonth(mois, -1))}
        aria-label="Mois précédent"
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        ←
      </button>
      <input
        type="month"
        value={mois}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
      />
      <button
        type="button"
        onClick={() => go(shiftMonth(mois, 1))}
        aria-label="Mois suivant"
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        →
      </button>
    </div>
  );
}
