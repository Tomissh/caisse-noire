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
import { centimesToEuros } from "@/lib/format";
import { CaisseInfoForm } from "./_info-form";
import { CotisationForm } from "./_cotisation";
import { AdminsBlock } from "./_admins";
import { DangerZone } from "./_danger-zone";

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
    .select("user_id, created_at, membre_id")
    .eq("caisse_id", caisseId);

  // Membres actifs de la caisse — pour le lien admin ↔ membre.
  const { data: membresRows } = await supabase
    .from("membres")
    .select("id, nom")
    .eq("caisse_id", caisseId)
    .eq("actif", true)
    .order("nom");
  const membreNameById = new Map<string, string>();
  for (const m of membresRows ?? []) {
    membreNameById.set(m.id, m.nom);
  }
  const membreIdsDejaLies = new Set(
    (adminsRows ?? []).map((r) => r.membre_id).filter((id): id is string => id !== null),
  );
  const membresDisponibles = (membresRows ?? [])
    .filter((m) => !membreIdsDejaLies.has(m.id))
    .map((m) => ({ id: m.id, nom: m.nom }));

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
    membreNom: r.membre_id ? (membreNameById.get(r.membre_id) ?? null) : null,
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

        <CotisationForm
          caisseId={caisseId}
          active={caisse.cotisation_active}
          montantEuros={centimesToEuros(caisse.cotisation_montant_centimes)}
          plafonneeParAmendes={caisse.cotisation_plafonnee_par_amendes}
          soldePrisEnCompte={caisse.cotisation_solde_pris_en_compte}
        />

        <AdminsBlock
          caisseId={caisseId}
          admins={adminsList}
          membresDisponibles={membresDisponibles}
          canManage={canManageAdmins}
        />

        <DangerZone
          caisseId={caisseId}
          caisseNom={caisse.nom}
          cloturee={Boolean(caisse.cloturee_at)}
          role={role}
        />
      </div>
    </main>
  );
}
