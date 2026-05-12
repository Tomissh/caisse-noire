// Page protégée par le layout (membre) → garde JWT via MembreAuthProvider.

import { ChangePasswordForm } from "./_form";

export const metadata = {
  title: "Changer mon mot de passe — Caisse Noire",
};

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Changer mon mot de passe
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pour confirmer, saisissez votre mot de passe actuel.
        </p>
      </header>
      <ChangePasswordForm />
    </div>
  );
}
