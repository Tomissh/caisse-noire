"use client";

// Liste des écritures rendue côté client :
//   - chaque ligne est cliquable pour expand/collapse (détails déclarant +
//     supprimée_at + motif_suppression)
//   - bouton "Supprimer" pour amendes/paiements (ouvre le dialog motif)
//   - retraits non supprimables (icône cadenas)

import { useState } from "react";
import { DeleteDialog } from "./delete-dialog";
import { formatSolde } from "@/lib/format";

export type EcritureItem = {
  type: "amende" | "paiement" | "retrait";
  id: string;
  caisseId: string;
  createdAt: string;
  montantCentimes: number;
  libelle: string;
  membreNom: string | null;
  moyen: "especes" | "virement" | "autre" | null;
  jourMatch: boolean;
  acteurEmail: string;
  supprimeeAt: string | null;
  motifSuppression: string | null;
  suppresseurEmail: string | null;
};

const BADGE_CLASS: Record<EcritureItem["type"], string> = {
  amende: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  paiement: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  retrait: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200",
};

const BADGE_LABEL: Record<EcritureItem["type"], string> = {
  amende: "A",
  paiement: "P",
  retrait: "R",
};

const MOYEN_LABEL: Record<NonNullable<EcritureItem["moyen"]>, string> = {
  especes: "espèces",
  virement: "virement",
  autre: "autre",
};

function signedMontantForRow(item: EcritureItem): number {
  // Affichage du signe : amende=négatif, paiement=positif, retrait=tel quel
  if (item.type === "amende") return -item.montantCentimes;
  if (item.type === "paiement") return item.montantCentimes;
  return -Math.abs(item.montantCentimes) * Math.sign(item.montantCentimes); // retrait stocké signé : sortie réelle = même signe
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EcrituresList({
  items,
  readOnly,
}: {
  items: EcritureItem[];
  readOnly: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EcritureItem | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
        {items.map((it) => {
          const expanded = expandedId === `${it.type}-${it.id}`;
          const isDeleted = Boolean(it.supprimeeAt);
          const signed = signedMontantForRow(it);

          return (
            <li key={`${it.type}-${it.id}`} className="text-sm">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : `${it.type}-${it.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  isDeleted ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${BADGE_CLASS[it.type]}`}
                  aria-label={it.type}
                >
                  {BADGE_LABEL[it.type]}
                </span>
                <span className="w-28 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDate(it.createdAt)}
                </span>
                <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">
                  {it.libelle}
                  {it.membreNom && it.type === "amende" && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}
                      — {it.membreNom}
                    </span>
                  )}
                  {it.moyen && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {MOYEN_LABEL[it.moyen]}
                    </span>
                  )}
                  {it.jourMatch && (
                    <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      jour de match ×2
                    </span>
                  )}
                  {isDeleted && (
                    <span className="ml-2 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                      supprimée
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 font-mono text-sm font-medium ${
                    signed > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : signed < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-600"
                  }`}
                >
                  {formatSolde(signed)}
                </span>
              </button>

              {expanded && (
                <div className="space-y-1 border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <div>
                    <strong>Enregistrée par :</strong> {it.acteurEmail}
                  </div>
                  {isDeleted && (
                    <>
                      <div>
                        <strong>Supprimée le :</strong> {it.supprimeeAt ? formatDate(it.supprimeeAt) : "?"}
                        {it.suppresseurEmail && <> par {it.suppresseurEmail}</>}
                      </div>
                      <div>
                        <strong>Motif :</strong> {it.motifSuppression}
                      </div>
                    </>
                  )}
                  {!isDeleted && !readOnly && (it.type === "amende" || it.type === "paiement") && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(it);
                        }}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                  {it.type === "retrait" && (
                    <div className="pt-1 text-zinc-500 dark:text-zinc-400">
                      Retrait immuable. Pour corriger : nouveau retrait avec montant inverse.
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {deleteTarget && (
        <DeleteDialog
          item={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
