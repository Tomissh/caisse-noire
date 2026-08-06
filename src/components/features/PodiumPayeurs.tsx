// Podium des plus gros payeurs d'un mois donné — partagé entre le dashboard
// admin et le dashboard membre pour que les deux affichent exactement le
// même classement (mêmes montants, même rendu visuel).
//
// Positions : 2e à gauche, 1er au centre (plus grand), 3e à droite (plus
// petit), tailles décroissantes — cf. maquette fournie.
//
// Chaque slot affiche la photo de profil du membre (avatar rond, URL signée
// résolue côté appelant) ; à défaut de photo, `Avatar` retombe sur son
// pictogramme par défaut. Le montant est affiché sous le nom, plus la photo
// ne sert plus à afficher le montant.

import { Avatar } from "./Avatar";

export type PayeurRow = {
  id: string;
  nom: string;
  montantCentimes: number;
  avatarUrl?: string | null;
};

const PODIUM_SLOTS: {
  rank: 0 | 1 | 2;
  medal: string;
  size: number;
  ring: string;
}[] = [
  {
    rank: 1,
    medal: "🥈",
    size: 96,
    ring: "border-zinc-300 dark:border-zinc-500",
  },
  {
    rank: 0,
    medal: "🥇",
    size: 112,
    ring: "border-amber-400 dark:border-amber-500",
  },
  {
    rank: 2,
    medal: "🥉",
    size: 80,
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
            <Avatar
              src={r.avatarUrl}
              size={slot.size}
              alt={r.nom}
              className={`border-4 ${slot.ring}`}
            />
            <div className="flex flex-col items-center text-center">
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {slot.medal} {r.nom}
              </div>
              <div className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {Math.round(r.montantCentimes / 100)}€
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
