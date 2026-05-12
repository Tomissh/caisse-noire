// Layout (admin) : exécute la garde côté serveur, hydrate AdminAuthProvider
// avec l'état initial (user + super-admin + caisses où il est admin/créateur).
//
// Redirige vers /login si pas de session Supabase Auth.

import { requireAdminUser } from "@/lib/auth/guard-admin";
import { AdminAuthProvider } from "@/lib/auth/admin-context";
import { AdminTopbar } from "./_components/topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = await requireAdminUser();

  return (
    <AdminAuthProvider initialState={state}>
      <div className="flex flex-1 flex-col">
        <AdminTopbar email={state.email} isSuperAdmin={state.isSuperAdmin} />
        <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
      </div>
    </AdminAuthProvider>
  );
}
