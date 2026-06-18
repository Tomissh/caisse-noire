// Création d'un compte Supabase Auth (futur admin de caisse ou super-admin).
// L'utilisateur peut ensuite se connecter via /login.

import { InviteForm } from "./_form";

export default function InvitePage() {
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Inviter un administrateur
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Crée un compte Supabase Auth. L&apos;utilisateur pourra se connecter sur{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">/login</code> avec
            les identifiants ci-dessous.
          </p>
        </header>
        <InviteForm />
      </div>
    </main>
  );
}
