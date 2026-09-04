// Dashboard d'une caisse — Phase 4.C.
//
// Total de la caisse : solde physique (paiements − retraits) via
// v_caisse_solde, seul chiffre mis en avant en haut du dashboard.
//
// Actions rapides : nouvelle amende / nouveau paiement / nouveau retrait.
//
// Podium des dettes : top 3 des membres au solde le plus bas (les plus
// endettés), sur la base du solde actuel (v_membre_situation), pas des
// paiements du mois — même donnée que la section Dettes, en médailles.
//
// Récapitulatif mensuel : ce que chaque membre a pris comme amendes durant
// le mois affiché (mois M), et ce qu'il a payé le mois suivant (M+1) — les
// membres paient leurs amendes du mois en début du mois d'après, donc le
// "payé" pertinent pour la ligne du mois M est celui de M+1, pas celui de M.
// RPC recap_mensuel_simple, navigable par mois via ?mois=YYYY-MM. Vue brute
// (pas de solde cumulé/reporté) — voir v_membre_situation et la carte
// Dettes pour le solde réel d'un membre. Classement copiable pour relance.
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
import { centimesToEuros, formatEuros } from "@/lib/format";
import type { EcritureItem } from "./ecritures/_components/list";
import { EcrituresList } from "./ecritures/_components/list";
import { MonthNav } from "./_components/month-nav";
import { ClassementPanel } from "./_components/classement-panel";
import { PodiumPayeurs } from "@/components/features/PodiumPayeurs";
import { DetteCard } from "./_components/dette-card";
import { NouvelleAmendeDialog } from "./ecritures/_components/nouvelle-amende-dialog";
import { NouveauPaiementDialog } from "./ecritures/_components/nouveau-paiement-dialog";
import { NouveauRetraitDialog } from "./ecritures/_components/nouveau-retrait-dialog";

// Mois courant, en heure locale de la caisse (Europe/Paris) — pas celle du
// serveur (UTC sur Vercel), pour rester cohérent avec le rattachement des
// écritures au mois fait par situation_caisse_mois (même fuseau).
function currentMonthDefault(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
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
    paiementsSumRes,
    retraitsSumRes,
    membresRes,
    motifsRes,
    situationsRes,
    packsRes,
    recapMoisRes,
    amendesLastRes,
    paiementsLastRes,
    retraitsLastRes,
  ] = await Promise.all([
    supabase.from("v_caisse_solde").select("*").eq("caisse_id", caisseId).maybeSingle(),
    supabase
      .from("paiements")
      .select("montant_centimes")
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null),
    supabase.from("retraits").select("montant_centimes").eq("caisse_id", caisseId),
    supabase.from("membres").select("id, nom, actif").eq("caisse_id", caisseId),
    supabase
      .from("motifs_amende")
      .select("id, libelle, montant_centimes, montant_variable")
      .eq("caisse_id", caisseId)
      .eq("actif", true)
      .order("libelle"),
    supabase
      .from("v_membre_situation")
      .select("membre_id, solde_centimes")
      .eq("caisse_id", caisseId),
    supabase.from("v_membre_packs").select("membre_id, packs_count").eq("caisse_id", caisseId),
    supabase.rpc("recap_mensuel_simple", { p_caisse_id: caisseId, p_mois: `${mois}-01` }),
    supabase
      .from("amendes")
      .select(
        "id, caisse_id, membre_id, libelle, montant_centimes, jour_match, declaree_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(nom)",
      )
      .eq("caisse_id", caisseId)
      .is("supprimee_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("paiements")
      .select(
        "id, caisse_id, membre_id, montant_centimes, moyen, enregistre_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(nom)",
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

  const totalPaiements = (paiementsSumRes.data ?? []).reduce(
    (s, r) => s + r.montant_centimes,
    0,
  );
  const totalRetraits = (retraitsSumRes.data ?? []).reduce(
    (s, r) => s + r.montant_centimes,
    0,
  );
  const soldePhysique = soldeRes.data?.solde_centimes ?? totalPaiements - totalRetraits;

  // Données pour les popups de saisie (amende/paiement) — actions rapides.
  const membresActifs = (membresRes.data ?? [])
    .filter((m) => m.actif)
    .map((m) => ({ id: m.id, nom: m.nom }));
  const motifsAmende = (motifsRes.data ?? []).map((m) => ({
    id: m.id,
    libelle: m.libelle,
    montantEuros: centimesToEuros(m.montant_centimes),
    montantVariable: m.montant_variable,
  }));

  // Dettes : requêtes séparées (membres + v_membre_situation + v_membre_packs)
  // fusionnées côté client, plutôt qu'un embed PostgREST qui échoue
  // silencieusement (une vue n'expose pas de clé étrangère vers `membres`).
  // Solde = cumul paiements − amendes (v_membre_situation) ; triées du plus
  // endetté (solde le plus négatif) au plus créditeur. Les membres désactivés
  // n'apparaissent plus que dans la page de gestion des membres. Le compteur
  // de packs (v_membre_packs) est affiché/modifiable directement sur la
  // carte et le popup — pas de section dédiée séparée.
  const soldeByMembreId = new Map<string, number>();
  for (const r of situationsRes.data ?? []) {
    if (r.membre_id) soldeByMembreId.set(r.membre_id, r.solde_centimes ?? 0);
  }
  const packsByMembreId = new Map<string, number>();
  for (const r of packsRes.data ?? []) {
    if (r.membre_id) packsByMembreId.set(r.membre_id, r.packs_count ?? 0);
  }
  const soldesParMembre = (membresRes.data ?? [])
    .filter((m) => m.actif)
    .map((m) => ({
      membreId: m.id,
      nom: m.nom,
      solde: soldeByMembreId.get(m.id) ?? 0,
      packs: packsByMembreId.get(m.id) ?? 0,
    }))
    .sort((a, b) => a.solde - b.solde);

  // Résolution emails déclarants pour les écritures du dashboard — calculé
  // avant les deux requêtes ci-dessous pour pouvoir les lancer en parallèle.
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

  // Photos de profil (bucket privé "avatars", pour Dettes + podium) et
  // emails des déclarants (Admin API) : deux requêtes indépendantes,
  // lancées en parallèle plutôt qu'enchaînées.
  const [{ data: avatarSignedUrls }, usersListRes] = await Promise.all([
    soldesParMembre.length > 0
      ? supabase.storage
          .from("avatars")
          .createSignedUrls(
            soldesParMembre.map((m) => `${caisseId}/${m.membreId}/avatar`),
            3600,
          )
      : Promise.resolve({ data: [] as { path: string | null; signedUrl: string | null }[] }),
    userIds.size > 0
      ? createAdminClient().auth.admin.listUsers({ perPage: 200 })
      : Promise.resolve({ data: { users: [] as { id: string; email?: string }[] } }),
  ]);
  const avatarUrlByMembreId = new Map<string, string>();
  for (const r of avatarSignedUrls ?? []) {
    if (!r.path || !r.signedUrl) continue;
    const membreId = r.path.split("/")[1];
    if (membreId) avatarUrlByMembreId.set(membreId, r.signedUrl);
  }
  const emailById = new Map<string, string>();
  for (const u of usersListRes.data?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  // Podium des dettes : top 3 des soldes les plus bas (mêmes données que
  // "Dettes" ci-dessous, en médailles).
  const podiumDettes = soldesParMembre.slice(0, 3).map((m) => ({
    id: m.membreId,
    nom: m.nom,
    montantCentimes: m.solde,
    avatarUrl: avatarUrlByMembreId.get(m.membreId) ?? null,
  }));

  // Récapitulatif mensuel — membres désactivés exclus (visibles uniquement
  // dans la page de gestion des membres).
  const recapRows = (recapMoisRes.data ?? []).filter((r) => r.actif).sort((a, b) => {
    if (b.amendes_mois_centimes !== a.amendes_mois_centimes) {
      return b.amendes_mois_centimes - a.amendes_mois_centimes;
    }
    return a.nom.localeCompare(b.nom);
  });
  const totalAPayer = recapRows.reduce((s, r) => s + r.amendes_mois_centimes, 0);
  const totalPaye = recapRows.reduce((s, r) => s + r.paiements_mois_suivant_centimes, 0);

  const items: EcritureItem[] = [];
  for (const a of amendesLastRes.data ?? []) {
    const m = (a.membres as unknown as { nom: string } | null) ?? null;
    items.push({
      type: "amende",
      id: a.id,
      caisseId: a.caisse_id,
      createdAt: a.created_at,
      montantCentimes: a.montant_centimes,
      libelle: a.libelle,
      membreNom: m ? m.nom : null,
      moyen: null,
      jourMatch: a.jour_match,
      acteurEmail: emailById.get(a.declaree_par_user_id) ?? a.declaree_par_user_id.slice(0, 8),
      supprimeeAt: a.supprimee_at,
      motifSuppression: a.motif_suppression,
      suppresseurEmail: null,
    });
  }
  for (const p of paiementsLastRes.data ?? []) {
    const m = (p.membres as unknown as { nom: string } | null) ?? null;
    items.push({
      type: "paiement",
      id: p.id,
      caisseId: p.caisse_id,
      createdAt: p.created_at,
      montantCentimes: p.montant_centimes,
      libelle: "Paiement",
      membreNom: m ? m.nom : null,
      moyen: p.moyen,
      jourMatch: false,
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
      jourMatch: false,
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
            <NouvelleAmendeDialog caisseId={caisseId} motifs={motifsAmende} membres={membresActifs} />
            <NouveauPaiementDialog caisseId={caisseId} membres={membresActifs} />
            <NouveauRetraitDialog caisseId={caisseId} />
          </div>
        </header>

        {/* Total de la caisse -------------------------------------------- */}
        <section className="rounded-lg border border-zinc-200 bg-white px-6 py-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total de la caisse
          </div>
          <div className="mt-1 font-mono text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatEuros(soldePhysique)}
          </div>
        </section>

        {/* Podium des dettes ------------------------------------------------ */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Plus grosses dettes 🏆
          </h2>
          {podiumDettes.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Aucun membre.
            </p>
          ) : (
            <PodiumPayeurs rows={podiumDettes} />
          )}
        </section>

        {/* Dettes ------------------------------------------------------- */}
        <section className="space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Dettes 💸
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
            <ul className="grid gap-3 lg:grid-cols-2">
              {soldesParMembre.map((m) => (
                <DetteCard
                  key={m.membreId}
                  caisseId={caisseId}
                  membreId={m.membreId}
                  nom={m.nom}
                  soldeCentimes={m.solde}
                  packsCount={m.packs}
                  avatarUrl={avatarUrlByMembreId.get(m.membreId) ?? null}
                />
              ))}
            </ul>
          )}
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
              nom: r.nom,
              montantAPayerCentimes: r.amendes_mois_centimes,
            }))}
          />
          {recapRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              Aucun membre.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[360px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <th className="px-3 py-2">Membre</th>
                    <th className="px-3 py-2 text-right">À payer</th>
                    <th className="px-3 py-2 text-right">Payé</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((r) => (
                    <tr
                      key={r.membre_id}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                    >
                      <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                        {r.nom}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        <span
                          className={
                            r.amendes_mois_centimes > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-500"
                          }
                        >
                          {formatEuros(r.amendes_mois_centimes)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatEuros(r.paiements_mois_suivant_centimes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-900">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right font-mono text-red-600 dark:text-red-400">
                      {formatEuros(totalAPayer)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-600 dark:text-zinc-400">
                      {formatEuros(totalPaye)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
            <EcrituresList items={lastFive} readOnly showActor={false} />
          )}
        </section>
      </div>
    </main>
  );
}

