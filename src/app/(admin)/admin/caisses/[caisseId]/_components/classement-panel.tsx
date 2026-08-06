"use client";

// Classement de tous les membres pour le mois affiché, trié par montant
// restant à payer décroissant, copiable en un clic dans le presse-papier
// pour être collé dans un message (WhatsApp, SMS...). Médailles pour le
// top 3, "0€" pour les membres à jour.

import { useState } from "react";
import { toast } from "sonner";

export type ClassementRow = {
  nom: string;
  montantAPayerCentimes: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatLine(row: ClassementRow, index: number): string {
  const euros = Math.round(row.montantAPayerCentimes / 100);
  const medal = MEDALS[index] ?? "";
  return `${medal}${row.nom} ${euros}€`;
}

export function ClassementPanel({ rows }: { rows: ClassementRow[] }) {
  const [open, setOpen] = useState(false);

  const onCopy = async () => {
    const text = rows.map(formatLine).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Classement copié");
    } catch {
      toast.error("Copie impossible");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {open ? "Masquer le classement" : "Classement à réclamer"}
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun membre.</p>
          ) : (
            <>
              <ol className="space-y-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
                {rows.map((r, i) => (
                  <li key={`${r.nom}-${i}`}>{formatLine(r, i)}</li>
                ))}
              </ol>
              <button
                type="button"
                onClick={onCopy}
                className="mt-3 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Copier le classement
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
