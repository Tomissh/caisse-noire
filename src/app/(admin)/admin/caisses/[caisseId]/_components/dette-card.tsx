"use client";

// Carte membre cliquable de la section "Dettes" du dashboard admin — ouvre
// le profil (photo, solde, dernières amendes) via MembreDetteDialog. Wrapper
// fin qui injecte le client Supabase de la session admin (useAdminAuth),
// MembreDetteDialog restant agnostique du contexte d'auth appelant.

import { useAdminAuth } from "@/lib/auth/admin-context";
import { MembreDetteDialog } from "@/components/features/MembreDetteDialog";
import { Avatar } from "@/components/features/Avatar";
import { formatSolde } from "@/lib/format";

export function DetteCard({
  caisseId,
  membreId,
  nom,
  soldeCentimes,
  avatarUrl,
}: {
  caisseId: string;
  membreId: string;
  nom: string;
  soldeCentimes: number;
  avatarUrl: string | null;
}) {
  const { supabase } = useAdminAuth();

  return (
    <li>
      <MembreDetteDialog
        supabase={supabase}
        caisseId={caisseId}
        membreId={membreId}
        nom={nom}
        soldeCentimes={soldeCentimes}
        avatarUrl={avatarUrl}
        triggerClassName="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60"
      >
        <div className="flex items-center gap-3">
          <Avatar src={avatarUrl} size={40} alt={nom} />
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{nom}</div>
        </div>
        <span
          className={`font-mono text-sm font-semibold ${
            soldeCentimes > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : soldeCentimes < 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500"
          }`}
        >
          {formatSolde(soldeCentimes)}
        </span>
      </MembreDetteDialog>
    </li>
  );
}
