// Création d'une caisse. Form simple : nom (requis) + description optionnelle.
// Le code est généré automatiquement par le server action (8 chars A-Z0-9).

import Link from "next/link";
import { CreateCaisseForm } from "./_form";

export const metadata = {
  title: "Nouvelle caisse — Caisse Noire",
};

export default function NewCaissePage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-1">
        <Link
          href="/admin"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Mes caisses
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Nouvelle caisse
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Le code d&apos;accès est généré automatiquement. Vous pourrez le régénérer plus tard
          depuis les paramètres de la caisse.
        </p>
      </header>
      <CreateCaisseForm />
    </div>
  );
}
