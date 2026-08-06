// Dashboard d'une caisse — Phase 4.C.
//
// KPIs (5 cards) :
//   - Solde physique (paiements − retraits) via v_caisse_solde
//   - Total amendes actives
//   - Total paiements actifs
//   - Total retraits (signe absolu = somme nette)
//   - Nombre de membres actifs
//
// Actions rapides : nouvelle amende / nouveau paiement / nouveau retrait.
//
// Récapitulatif mensuel : ce que chaque membre doit encore payer pour un
// mois donné, en tenant compte de son solde reporté (avance/retard) —
// RPC situation_caisse_mois, navigable par mois via ?mois=YYYY-MM. Un
// paiement est rattaché au mois des amendes qu'il solde (décalage de 7 j),
// pas au mois où il a été enregistré. Classement copiable pour relance.
//
// Soldes par membre : liste de cards triée par solde décroissant
// (créditeurs en haut, dettes en bas). Requête en deux temps (membres +
// v_membre_situation) car PostgREST ne sait pas embarquer une relation à
// travers une vue sans clé étrangère réelle.
//
// 5 dernières écritures (3 types unifiés, sort created_at desc).

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros, formatSolde } from "@/lib/format";
import type { EcritureItem } from "./ecritures/_components/list";
import { EcrituresList } from "./ecritures/_components/list";
import { MonthNav } from "./_components/month-nav";
import { ClassementPanel } from "./_components/classement-panel";

function currentMonthDefault(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function moisLabel(mois: string): string {
  const [y, m] = mois.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1));
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function CaisseDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ caisseId: string }>;
  searchParams: Promise<{ mois?: string }>;
}) {
  const { caisseId } = await params;
  const { mois: moisParam } = await searchParams;
  const ctx = await requireCaisseAdmin(caisseId);
  const supabase = await createClient();

  const mois = /^\d{4}-\d{2}$/.test(moisParam ?? "") ? moisParam! : currentMonthDefault();

  const [
    soldeRes,
    amendesSumRes,
    paiementsSumRes,
    retraitsSumRes,
    membresActifsRes,
    membresRes,
    situationsRes,
    recapMoisRes,
    amendesLastRes,
    paiementsLastRes,
    retraitsLastRes,
  ] = await Promise.all([
    supabase.from("v_caisse_solde").select("*").eq("caisse_id", caisseId).maybeSingle(),
    supabase
      .from("amendes")
      .select("montant_centimes")
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null),
    supabase
      .from("paiements")
      .select("montant_centimes")
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null),
    supabase.from("retraits").select("montant_centimes").eq("caisse_id", caisseId),
    supabase
      .from("membres")
      .select("id", { count: "exact", head: true })
      .eq("caisse_id", caisseId)
      .eq("actif", true),
    supabase.from("membres").select("id, prenom, nom, actif").eq("caisse_id", caisseId),
    supabase
      .from("v_membre_situation")
      .select("membre_id, solde_centimes")
      .eq("caisse_id", caisseId),
    supabase.rpc("situation_caisse_mois", { p_caisse_id: caisseId, p_mois: `${mois}-01` }),
    supabase
      .from("amendes")
      .select(
        "id, caisse_id, membre_id, libelle, montant_centimes, declaree_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(prenom, nom)",
      )
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("paiements")
      .select(
        "id, caisse_id, membre_id, montant_centimes, moyen, enregistre_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(prenom, nom)",
      )
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("retraits")
      .select("id, caisse_id, libelle, montant_centimes, enregistre_par_user_id, created_at")
      .eq("caisse_id", caisseId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalAmendes = (amendesSumRes.data ?? []).reduce((s, r) => s + r.montant_centimes, 0);
  const totalPaiements = (paiementsSumRes.data ?? []).reduce(
    (s, r) => s + r.montant_centimes,
    0,
  );
  const totalRetraits = (retraitsSumRes.data ?? []).reduce(
    (s, r) => s + r.montant_centimes,
    0,
  );
  const soldePhysique = soldeRes.data?.solde_centimes ?? totalPaiements - totalRetraits;
  const nbMembresActifs = membresActifsRes.count ?? 0;

  // Soldes par membre : deux requêtes séparées (membres + v_membre_situation)
  // fusionnées côté client, plutôt qu'un embed PostgREST qui échoue silen-
  // cieusement (une vue n'expose pas de clé étrangère vers `membres`).
  const soldeByMembreId = new Map<string, number>();
  for (const r of situationsRes.data ?? []) {
    if (r.membre_id) soldeByMembreId.set(r.membre_id, r.solde_centimes ?? 0);
  }
  const soldesParMembre = (membresRes.data ?? [])
    .map((m) => ({
      membreId: m.id,
      prenom: m.prenom,
      nom: m.nom,
      actif: m.actif,
      solde: soldeByMembreId.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.solde - a.solde);

  // Récapitulatif mensuel
  const recapRows = [...(recapMoisRes.data ?? [])].sort((a, b) => {
    if (b.montant_a_payer_centimes !== a.montant_a_payer_centimes) {
      return b.montant_a_payer_centimes - a.montant_a_payer_centimes;
    }
    return a.prenom.localeCompare(b.prenom);
  });
  const totalAPayer = recapRows.reduce((s, r) => s + r.montant_a_payer_centimes, 0);

  // Résolution emails déclarants pour les écritures du dashboard
  const userIds = new Set<string>();
  for (const a of amendesLastRes.data ?? []) {
    if (a.declaree_par_user_id) userIds.add(a.declaree_par_user_id);
  }
  for (const p of paiementsLastRes.data ?? []) {
    if (p.enregistre_par_user_id) userIds.add(p.enregistre_par_user_id);
  }
  for (const r of retraitsLastRes.data ?? []) {
    if (r.enregistre_par_user_id) userIds.add(r.enregistre_par_user_id);
  }
  const emailById = new Map<string, string>();
  if (userIds.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email) emailById.set(u.id, u.email);
    }
  }

  const items: EcritureItem[] = [];
  for (const a of amendesLastRes.data ?? []) {
    const m = (a.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    items.push({
      type: "amende",
      id: a.id,
      caisseId: a.caisse_id,
      createdAt: a.created_at,
      montantCentimes: a.montant_centimes,
      libelle: a.libelle,
      membreNom: m ? `${m.prenom} ${m.nom}` : null,
      moyen: null,
      acteurEmail: emailById.get(a.declaree_par_user_id) ?? a.declaree_par_user_id.slice(0, 8),
      supprimeeAt: a.supprimee_at,
      motifSuppression: a.motif_suppression,
      suppresseurEmail: null,
    });
  }
  for (const p of paiementsLastRes.data ?? []) {
    const m = (p.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    items.push({
      type: "paiement",
      id: p.id,
      caisseId: p.caisse_id,
      createdAt: p.created_at,
      montantCentimes: p.montant_centimes,
      libelle: m ? `Paiement ${m.prenom} ${m.nom}` : "Paiement",
      membreNom: m ? `${m.prenom} ${m.nom}` : null,
      moyen: p.moyen,
      acteurEmail: emailById.get(p.enregistre_par_user_id) ?? p.enregistre_par_user_id.slice(0, 8),
      supprimeeAt: p.supprimee_at,
      motifSuppression: p.motif_suppression,
      suppresseurEmail: null,
    });
  }
  for (const r of retraitsLastRes.data ?? []) {
    items.push({
      type: "retrait",
      id: r.id,
      caisseId: r.caisse_id,
      createdAt: r.created_at,
      montantCentimes: r.montant_centimes,
      libelle: r.libelle,
      membreNom: null,
      moyen: null,
      acteurEmail: emailById.get(r.enregistre_par_user_id) ?? r.enregistre_par_user_id.slice(0, 8),
      supprimeeAt: null,
      motifSuppression: null,
      suppresseurEmail: null,
    });
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const lastFive = items.slice(0, 5);

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {ctx.caisse.nom}
            </h1>
            {ctx.caisse.description && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{ctx.caisse.description}</p>
            )}
          </div>
          {/* Actions rapides ------------------------------------------- */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/caisses/${caisseId}/ecritures/amende/new`}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              + Amende
            </Link>
            <Link
              href={`/admin/caisses/${caisseId}/ecritures/paiement/new`}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Paiement
            </Link>
            <Link
              href={`/admin/caisses/${caisseId}/ecritures/retrait/new`}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              + Retrait
            </Link>
          </div>
        </header>

        {/* KPI cards ---------------------------------------------------- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Solde caisse" value={formatSolde(soldePhysique)} accent="strong" />
          <KpiCard label="Total amendes" value={formatEuros(totalAmendes)} accent="red" />
          <KpiCard label="Total paiements" value={formatEuros(totalPaiements)} accent="green" />
          <KpiCard label="Total retraits" value={formatEuros(totalRetraits)} accent="orange" />
          <KpiCard label="Membres actifs" value={String(nbMembresActifs)} />
        </section>

        {/* Récapitulatif mensuel ----------------------------------------- */}
        <section className="space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Récapitulatif mensuel
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{moisLabel(mois)}</p>
            </div>
            <div className="flex items-center gap-2">
              <MonthNav mois={mois} caisseId={caisseId} />
            </div>
          </header>

          <ClassementPanel
            rows={recapRows.map((r) => ({
              prenom: r.prenom,
              nom: r.nom,
              montantAPayerCentimes: r.montant_a_payer_centimes,
            }))}
          />
          {recapRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Aucun membre.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-3 py-2">Membre</th>
                    <th className="px-3 py-2 text-right">Solde reporté</th>
                    <th className="px-3 py-2 text-right">Amendes du mois</th>
                    <th className="px-3 py-2 text-right">Payé ce mois</th>
                    <th className="px-3 py-2 text-right">À payer</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((r) => (
                    <tr
                      key={r.membre_id}
                      className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/60 ${
                        r.actif ? "" : "opacity-60"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {r.prenom} {r.nom}
                        {!r.actif && (
                          <span className="ml-1.5 text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                            (désactivé)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatSolde(r.solde_avant_centimes)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-900 dark:text-zinc-50">
                        {formatEuros(r.amendes_mois_centimes)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatEuros(r.paiements_mois_centimes)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {r.montant_a_payer_centimes > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            {formatEuros(r.montant_a_payer_centimes)}
                          </span>
                        ) : r.avance_centimes > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            à jour (+{formatEuros(r.avance_centimes)})
                          </span>
                        ) : (
                          <span className="text-zinc-500">à jour</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {totalAPayer > 0 && (
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                      <td className="px-3 py-2" colSpan={4}>
                        Total restant à payer
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">
                        {formatEuros(totalAPayer)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>

        {/* Soldes par membre ------------------------------------------- */}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Soldes par membre
            </h2>
            <Link
              href={`/admin/caisses/${caisseId}/membres`}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Gérer les membres →
            </Link>
          </header>
          {soldesParMembre.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Aucun membre. <Link href={`/admin/caisses/${caisseId}/membres/new`} className="underline">Ajouter le premier</Link>.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {soldesParMembre.map((m) => (
                <li
                  key={m.membreId}
                  className={`flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
                    m.actif ? "" : "opacity-60"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {m.prenom} {m.nom}
                    </div>
                    {!m.actif && (
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400">désactivé</div>
                    )}
                  </div>
                  <span
                    className={`font-mono text-sm font-semibold ${
                      m.solde > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : m.solde < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-500"
                    }`}
                  >
                    {formatSolde(m.solde)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Dernières écritures ----------------------------------------- */}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Dernières écritures
            </h2>
            <Link
              href={`/admin/caisses/${caisseId}/ecritures`}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Voir tout →
            </Link>
          </header>
          {lastFive.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Aucune écriture pour le moment.
            </p>
          ) : (
            <EcrituresList items={lastFive} readOnly />
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "strong" | "red" | "green" | "orange";
}) {
  const valueClass = {
    strong: "text-zinc-900 dark:text-zinc-50",
    red: "text-red-600 dark:text-red-400",
    green: "text-emerald-600 dark:text-emerald-400",
    orange: "text-orange-600 dark:text-orange-400",
  }[accent ?? "strong"];

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
