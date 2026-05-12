// Paramètres d'une caisse :
//   - édition nom / description
//   - régénération du code d'accès
//   - liste des admins additionnels + ajout par email + retrait
//   - danger zone (clôture) → Phase 4.D
//
// Les actions d'ajout/retrait d'admin sont restreintes par RLS au créateur et
// super-admin ; les autres admins voient le bloc mais l'action échouera.

import { notFound } from "next/navigation";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CaisseInfoForm } from "./_info-form";
import { AdminsBlock } from "./_admins";

export default async function ParametresPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const { caisse, role } = await requireCaisseAdmin(caisseId);
  if (!caisse) notFound();

  const supabase = await createClient();

  // Liste des admins additionnels (hors créateur).
  const { data: adminsRows } = await supabase
    .from("admins_caisse")
    .select("user_id, created_at")
    .eq("caisse_id", caisseId);

  // Résoudre les emails via service-role (pas de FK exposée vers auth.users).
  const adminClient = createAdminClient();
  const { data: usersList } = await adminClient.auth.admin.listUsers({ perPage: 200 });
  const emailByUserId = new Map<string, string>();
  for (const u of usersList?.users ?? []) {
    if (u.email) emailByUserId.set(u.id, u.email);
  }
  const createurEmail = emailByUserId.get(caisse.createur_id) ?? "—";
  const adminsList = (adminsRows ?? []).map((r) => ({
    userId: r.user_id,
    email: emailByUserId.get(r.user_id) ?? "(email inconnu)",
  }));

  const canManageAdmins = role === "createur" || role === "super_admin";

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Paramètres
          </h1>
        </header>

        <CaisseInfoForm
          caisseId={caisseId}
          nom={caisse.nom}
          description={caisse.description ?? ""}
          code={caisse.code}
        />

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Créateur</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{createurEmail}</p>
        </section>

        <AdminsBlock
          caisseId={caisseId}
          admins={adminsList}
          canManage={canManageAdmins}
        />

        <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-950/30">
          <h2 className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Zone sensible
          </h2>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            La clôture de la caisse sera disponible en Phase 4.D.
          </p>
        </section>
      </div>
    </main>
  );
}
