"use client";

// Déclenchement manuel de la cotisation mensuelle pour le mois affiché du
// récapitulatif — remplace le cron retiré (pas de notion de "clôture du
// mois en cours" dans l'app, voir 20260910170000_cotisation_manuelle.sql).
// Idempotent côté RPC : un second clic sur un mois déjà généré ne crée pas
// de doublon, renvoie juste 0.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { genererCotisationMoisAction } from "../_actions";

export function GenererCotisationButton({
  caisseId,
  mois,
}: {
  caisseId: string;
  /** "YYYY-MM" — le mois actuellement affiché dans le récapitulatif. */
  mois: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await genererCotisationMoisAction({ caisseId, mois });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.count && res.count > 0
          ? `Cotisation générée pour ${res.count} membre${res.count > 1 ? "s" : ""}`
          : "Cotisation déjà à jour pour ce mois",
      );
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {pending ? "Génération…" : "Générer la cotisation"}
    </button>
  );
}
