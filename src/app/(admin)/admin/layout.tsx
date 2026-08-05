// Layout (admin) : exécute la garde côté serveur, hydrate AdminAuthProvider
// avec l'état initial (user + super-admin + caisses où il est admin/créateur).
//
// Redirige vers /login si pas de session Supabase Auth.
//
// Pas de bandeau/topbar ici : chaque section gère sa propre chrome (la
// sidebar caisse porte la marque + déconnexion pour /admin/caisses/[id]/*,
// AdminTopbar est réutilisé localement pour /admin et /admin/super/*).

import { requireAdminUser } from "@/lib/auth/guard-admin";
import { AdminAuthProvider } from "@/lib/auth/admin-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = await requireAdminUser();

  return (
    <AdminAuthProvider initialState={state}>
      <div className="flex flex-1 flex-col">{children}</div>
    </AdminAuthProvider>
  );
}
