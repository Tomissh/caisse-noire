// Page de connexion membre.
// Auth via l'Edge Function login-membre (code_caisse + prénom + nom + mdp),
// qui renvoie un JWT custom stocké en localStorage (30 j).

import { MembreLoginForm } from "./_form";

export const metadata = {
  title: "Connexion membre — Caisse Noire",
};

export default function MembreLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Connexion membre
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Identifiez-vous avec le code de votre caisse et votre nom.
          </p>
        </header>
        <MembreLoginForm />
      </div>
    </div>
  );
}
