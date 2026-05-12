"use client";

import { useMembreAuth } from "@/lib/auth/membre-context";

export default function MembrePage() {
  const { claims } = useMembreAuth();
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Bienvenue
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Vous êtes connecté en tant que membre. Le tableau de bord (solde, amendes,
        paiements) sera disponible en Phase 4.
      </p>
      <pre className="rounded-md bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {JSON.stringify({ caisse_id: claims.caisse_id, membre_id: claims.membre_id }, null, 2)}
      </pre>
    </div>
  );
}
