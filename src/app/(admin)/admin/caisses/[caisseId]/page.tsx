// Dashboard d'une caisse — Phase 4.C.
//
// KPIs (5 cards) :
//   - Solde physique (paiements − retraits) via v_caisse_solde
//   - Total amendes actives
//   - Total paiements actifs
//   - Total retraits (signe absolu = somme nette)
//   - Nombre de membres actifs
//
// Soldes par membre : liste de cards triée par solde décroissant
// (créditeurs en haut, dettes en bas), via v_membre_situation.
//
// 5 dernières écritures (3 types unifiés, sort created_at desc).

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEuros, formatSolde } from "@/lib/format";
import type { EcritureItem } from "./ecritures/_components/list";
import { EcrituresList } from "./ecritures/_components/list";

export default async function CaisseDashboardPage({
  params,
}: {
  params: Promise<{ caisseId: string }>;
}) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);
  const supabase = await createClient();

  const [
    soldeRes,
    amendesSumRes,
    paiementsSumRes,
    retraitsSumRes,
    membresActifsRes,
    situationsRes,
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
    supabase
      .from("v_membre_situation")
      .select("membre_id, total_amendes_centimes, total_paiements_centimes, solde_centimes, membres!inner(id, prenom, nom, actif)")
      .eq("caisse_id", caisseId),
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

  // Soldes par membre : tri solde décroissant
  type SituationRow = {
    membre_id: string | null;
    solde_centimes: number | null;
    membres: { id: string; prenom: string; nom: string; actif: boolean } | null;
  };
  const soldesParMembre = ((situationsRes.data as unknown as SituationRow[]) ?? [])
    .filter((r) => r.membres !== null)
    .map((r) => ({
      membreId: r.membre_id ?? "",
      prenom: r.membres!.prenom,
      nom: r.membres!.nom,
      actif: r.membres!.actif,
      solde: r.solde_centimes ?? 0,
    }))
    .sort((a, b) => b.solde - a.solde);

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
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {ctx.caisse.nom}
          </h1>
          {ctx.caisse.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{ctx.caisse.description}</p>
          )}
        </header>

        {/* KPI cards ---------------------------------------------------- */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Solde caisse" value={formatSolde(soldePhysique)} accent="strong" />
          <KpiCard label="Total amendes" value={formatEuros(totalAmendes)} accent="red" />
          <KpiCard label="Total paiements" value={formatEuros(totalPaiements)} accent="green" />
          <KpiCard label="Total retraits" value={formatEuros(totalRetraits)} accent="orange" />
          <KpiCard label="Membres actifs" value={String(nbMembresActifs)} />
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
