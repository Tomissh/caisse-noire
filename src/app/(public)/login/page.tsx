// Page de connexion admin / super-admin.
// Auth via Supabase Auth (email + mot de passe). En cas de succès, redirige
// vers /admin (le layout (admin) charge les rôles et bascule éventuellement
// vers /admin/super si super-admin et URL le demande).

import { AdminLoginForm } from "./_form";

export const metadata = {
  title: "Connexion administrateur — Caisse Noire",
};

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Connexion administrateur
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Réservé aux administrateurs de caisse et super-administrateurs.
          </p>
        </header>
        <AdminLoginForm />
      </div>
    </div>
  );
}
