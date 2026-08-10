"use client";

// Dialog de soft-delete : demande un motif ≥ 5 chars, appelle l'action.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { EcritureItem } from "./list";
import { supprimerAmendeAction, supprimerPaiementAction } from "../_actions";

export function DeleteDialog({
  item,
  onClose,
}: {
  item: EcritureItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [motif, setMotif] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (motif.trim().length < 5) {
      setError("Motif requis (≥ 5 caractères)");
      return;
    }
    setPending(true);
    const res =
      item.type === "amende"
        ? await supprimerAmendeAction({
            caisseId: item.caisseId,
            amendeId: item.id,
            motif,
          })
        : await supprimerPaiementAction({
            caisseId: item.caisseId,
            paiementId: item.id,
            motif,
          });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Écriture supprimée");
    onClose();
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <header>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Supprimer cette écriture ?
          </h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {item.membreNom && `${item.membreNom} — `}
            {item.libelle}
          </p>
        </header>

        <div className="space-y-1">
          <label htmlFor="motif" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Motif de suppression (≥ 5 caractères)
          </label>
          <textarea
            id="motif"
            rows={3}
            autoFocus
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="Ex. Erreur de saisie, double déclaration…"
          />
          {error && (
            <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Suppression…" : "Confirmer"}
          </button>
        </div>
      </form>
    </div>
  );
}
