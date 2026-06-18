"use client";

// Zone sensible : clôture (créateur/super-admin) et réouverture (super-admin
// uniquement). La clôture demande de retaper le nom de la caisse en
// confirmation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cloturerCaisseAction, reouvrirCaisseAction } from "./_actions";
import type { AdminRole } from "@/lib/auth/roles";

export function DangerZone({
  caisseId,
  caisseNom,
  cloturee,
  role,
}: {
  caisseId: string;
  caisseNom: string;
  cloturee: boolean;
  role: AdminRole;
}) {
  const router = useRouter();
  const canCloture = !cloturee && (role === "createur" || role === "super_admin");
  const canReouvrir = cloturee && role === "super_admin";

  const [showCloture, setShowCloture] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirmCloture = async () => {
    setError(null);
    if (confirmation !== caisseNom) {
      setError("Le nom retapé ne correspond pas");
      return;
    }
    setPending(true);
    const res = await cloturerCaisseAction({ caisseId, confirmationNom: confirmation });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Caisse clôturée");
    setShowCloture(false);
    setConfirmation("");
    router.refresh();
  };

  const onReouvrir = async () => {
    if (!confirm("Réouvrir cette caisse ?")) return;
    setPending(true);
    const res = await reouvrirCaisseAction({ caisseId });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Caisse réouverte");
    router.refresh();
  };

  return (
    <>
      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
        <h2 className="text-sm font-medium text-amber-900 dark:text-amber-200">Zone sensible</h2>

        {!cloturee && (
          <div className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
            <p>
              Clôturer la caisse empêche toute nouvelle écriture (amendes, paiements, retraits,
              membres, motifs). Les données restent consultables. Seul un super-administrateur
              peut réouvrir une caisse clôturée.
            </p>
            {canCloture ? (
              <button
                type="button"
                onClick={() => setShowCloture(true)}
                className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                Clôturer la caisse
              </button>
            ) : (
              <p className="text-xs italic text-amber-700 dark:text-amber-400">
                Seul le créateur (ou un super-administrateur) peut clôturer la caisse.
              </p>
            )}
          </div>
        )}

        {cloturee && (
          <div className="space-y-2 text-sm text-amber-800 dark:text-amber-300">
            <p>La caisse est actuellement clôturée — toutes les écritures sont bloquées.</p>
            {canReouvrir ? (
              <button
                type="button"
                onClick={onReouvrir}
                disabled={pending}
                className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900/40"
              >
                {pending ? "Réouverture…" : "Réouvrir la caisse"}
              </button>
            ) : (
              <p className="text-xs italic text-amber-700 dark:text-amber-400">
                Seul un super-administrateur peut réouvrir une caisse clôturée.
              </p>
            )}
          </div>
        )}
      </section>

      {showCloture && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
            <header>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Clôturer la caisse ?
              </h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Pour confirmer, retapez exactement le nom de la caisse :
              </p>
              <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-50">
                {caisseNom}
              </p>
            </header>
            <input
              autoFocus
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Nom de la caisse"
            />
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCloture(false);
                  setConfirmation("");
                  setError(null);
                }}
                className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onConfirmCloture}
                disabled={pending || confirmation !== caisseNom}
                className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Clôture…" : "Confirmer la clôture"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
