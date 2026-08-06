// Podium des plus gros payeurs d'un mois donné — partagé entre le dashboard
// admin et le dashboard membre pour que les deux affichent exactement le
// même classement (mêmes montants, même rendu visuel).
//
// Positions : 2e à gauche, 1er au centre (plus grand), 3e à droite (plus
// petit), tailles décroissantes — cf. maquette fournie.

export type PayeurRow = { id: string; prenom: string; montantCentimes: number };

const PODIUM_SLOTS: {
  rank: 0 | 1 | 2;
  medal: string;
  circle: string;
  ring: string;
}[] = [
  {
    rank: 1,
    medal: "🥈",
    circle: "h-24 w-24 text-sm",
    ring: "border-zinc-300 dark:border-zinc-500",
  },
  {
    rank: 0,
    medal: "🥇",
    circle: "h-28 w-28 text-base",
    ring: "border-amber-400 dark:border-amber-500",
  },
  {
    rank: 2,
    medal: "🥉",
    circle: "h-20 w-20 text-sm",
    ring: "border-orange-700/70 dark:border-orange-600/70",
  },
];

export function PodiumPayeurs({ rows }: { rows: PayeurRow[] }) {
  return (
    <div className="flex items-end justify-center gap-6 rounded-lg border border-zinc-200 bg-white px-6 py-8 dark:border-zinc-800 dark:bg-zinc-900">
      {PODIUM_SLOTS.map((slot) => {
        const r = rows[slot.rank];
        if (!r) return null;
        return (
          <div key={r.id} className="flex flex-col items-center gap-2">
            <div
              className={`flex items-center justify-center rounded-full border-4 bg-zinc-50 font-mono font-bold text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 ${slot.circle} ${slot.ring}`}
            >
              {Math.round(r.montantCentimes / 100)}€
            </div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {slot.medal} {r.prenom}
            </div>
          </div>
        );
      })}
    </div>
  );
}
