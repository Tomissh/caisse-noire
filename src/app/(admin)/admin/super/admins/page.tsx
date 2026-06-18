// Gestion des super-administrateurs.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/guard-admin";
import { AddSuperAdminForm } from "./_add-form";
import { RemoveButton } from "./_remove-button";

export default async function SuperAdminsPage() {
  const ctx = await requireSuperAdmin();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("super_admins")
    .select("user_id, created_at")
    .order("created_at");

  const ids = new Set<string>((rows ?? []).map((r) => r.user_id));
  const emailsById = new Map<string, string>();
  if (ids.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email && ids.has(u.id)) emailsById.set(u.id, u.email);
    }
  }

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Super-administrateurs
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Ces comptes peuvent voir et agir sur toutes les caisses (lecture, écriture,
            clôture, réouverture).
          </p>
        </header>

        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {(rows ?? []).map((r) => {
            const isMe = r.user_id === ctx.userId;
            return (
              <li
                key={r.user_id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="text-zinc-800 dark:text-zinc-200">
                  {emailsById.get(r.user_id) ?? r.user_id.slice(0, 12)}
                  {isMe && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      vous
                    </span>
                  )}
                </span>
                {!isMe && <RemoveButton userId={r.user_id} />}
              </li>
            );
          })}
        </ul>

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Ajouter un super-admin
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            L&apos;email doit déjà correspondre à un compte Supabase Auth existant. Pour
            créer un nouveau compte, passez par « Inviter un admin ».
          </p>
          <AddSuperAdminForm />
        </section>
      </div>
    </main>
  );
}
