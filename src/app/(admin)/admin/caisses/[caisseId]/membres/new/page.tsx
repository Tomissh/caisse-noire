// Ajout d'un membre à une caisse. L'admin saisit prénom, nom et un mot de
// passe initial (qu'il peut générer aléatoirement). Le mdp s'affiche en
// clair dans le champ pour qu'il puisse le copier et le transmettre au membre.

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { NewMembreForm } from "./_form";

export default async function NewMembrePage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  await requireCaisseAdmin(caisseId);

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-1">
          <Link
            href={`/admin/caisses/${caisseId}/membres`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Membres
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Nouveau membre
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Définissez un mot de passe initial à transmettre au membre.
          </p>
        </header>
        <NewMembreForm caisseId={caisseId} />
      </div>
    </main>
  );
}
