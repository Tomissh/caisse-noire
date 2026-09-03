"use client";

// Pop-up profil d'un membre, ouverte en cliquant sa carte dans "Dettes" —
// partagée entre le dashboard admin et le dashboard membre (même rendu,
// même client Supabase passé par l'appelant : session admin ou JWT custom
// membre selon le contexte).
//
// Contenu : photo + nom + solde (même présentation que le podium), puis les
// dernières amendes attribuées — chargées à l'ouverture seulement (pas au
// chargement de la liste, pour éviter une requête par membre affiché).

import { useState, useTransition } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar } from "./Avatar";
import { formatEuros, formatSolde } from "@/lib/format";
import {
  ajouterPackAction,
  retirerPackAction,
} from "@/app/(admin)/admin/caisses/[caisseId]/_actions";

type AmendeRow = {
  id: string;
  libelle: string;
  montant_centimes: number;
  jour_match: boolean;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function MembreDetteDialog({
  supabase,
  caisseId,
  membreId,
  nom,
  soldeCentimes,
  packsCount = 0,
  canEditPacks = false,
  avatarUrl,
  triggerClassName,
  children,
}: {
  supabase: SupabaseClient<Database>;
  caisseId: string;
  membreId: string;
  nom: string;
  soldeCentimes: number;
  packsCount?: number;
  canEditPacks?: boolean;
  avatarUrl: string | null;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [amendes, setAmendes] = useState<AmendeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState(packsCount);
  const [prevPacksCount, setPrevPacksCount] = useState(packsCount);
  const [packsPending, startPacksTransition] = useTransition();

  // Resynchronise si le parent reçoit une nouvelle prop (revalidation Next
  // après une action ailleurs) — pattern React "adjust state on prop
  // change" dans le corps du render, pas un effect (évite un rendu de plus).
  if (packsCount !== prevPacksCount) {
    setPrevPacksCount(packsCount);
    setPacks(packsCount);
  }

  const handlePackChange = (delta: 1 | -1) => {
    startPacksTransition(async () => {
      const action = delta === 1 ? ajouterPackAction : retirerPackAction;
      const res = await action({ caisseId, membreId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPacks((p) => p + delta);
    });
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next || amendes !== null || loading) return;
    setLoading(true);
    setError(null);
    supabase
      .from("amendes")
      .select("id, libelle, montant_centimes, jour_match, created_at")
      .eq("caisse_id", caisseId)
      .eq("membre_id", membreId)
      .is("supprimee_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error: err }) => {
        setLoading(false);
        if (err) {
          setError("Chargement impossible");
          return;
        }
        setAmendes(data ?? []);
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger className={triggerClassName}>{children}</DialogTrigger>
      {open && (
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">{nom}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-2 pt-1">
            <Avatar
              src={avatarUrl}
              size={96}
              alt={nom}
              className="border-4 border-zinc-200 dark:border-zinc-700"
            />
            <div className="text-center">
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {nom}
              </div>
              <div
                className={`font-mono text-sm font-bold ${
                  soldeCentimes > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : soldeCentimes < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-zinc-500"
                }`}
              >
                {formatSolde(soldeCentimes)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {packs} pack{packs > 1 ? "s" : ""}
              </span>
              {canEditPacks && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={packsPending || packs <= 0}
                    onClick={() => handlePackChange(-1)}
                    aria-label="Retirer un pack"
                    className="h-6 w-6 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={packsPending}
                    onClick={() => handlePackChange(1)}
                    aria-label="Ajouter un pack"
                    className="h-6 w-6 rounded-md border border-zinc-300 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Dernières amendes
            </h3>
            {loading && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Chargement…</p>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!loading && !error && amendes && amendes.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucune amende.</p>
            )}
            {!loading && !error && amendes && amendes.length > 0 && (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {amendes.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-1.5 text-sm"
                  >
                    <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                      {a.libelle}
                      {a.jour_match && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          JDM
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(a.created_at)}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-medium text-red-600 dark:text-red-400">
                      {formatEuros(a.montant_centimes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
