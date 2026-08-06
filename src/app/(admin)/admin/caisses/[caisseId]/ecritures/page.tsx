// Liste unifiée des écritures (amendes / paiements / retraits).
//   - Tabs : Toutes / Amendes / Paiements / Retraits (via ?tab=)
//   - Filtres : membre, période, inclure supprimées (via ?membre=, ?from=, ?to=, ?deleted=)
//   - Pagination "Charger plus" (via ?limit=N, défaut 50)
//
// Le merge "Toutes" est fait côté serveur après 3 fetch parallèles.

import Link from "next/link";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FilterBar } from "./_components/filter-bar";
import { EcrituresList, type EcritureItem } from "./_components/list";

type Tab = "toutes" | "amendes" | "paiements" | "retraits";

const VALID_TABS: Tab[] = ["toutes", "amendes", "paiements", "retraits"];

function parseTab(v: string | string[] | undefined): Tab {
  if (typeof v === "string" && (VALID_TABS as readonly string[]).includes(v)) {
    return v as Tab;
  }
  return "toutes";
}

function parseString(v: string | string[] | undefined): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function parseLimit(v: string | string[] | undefined): number {
  if (typeof v !== "string") return 50;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n <= 0) return 50;
  return Math.min(n, 500);
}

export default async function EcrituresPage({
  params,
  searchParams,
}: {
  params: Promise<{ caisseId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { caisseId } = await params;
  const sp = await searchParams;

  const ctx = await requireCaisseAdmin(caisseId);
  const cloturee = Boolean(ctx.caisse.cloturee_at);

  const tab = parseTab(sp.tab);
  const membreFilter = parseString(sp.membre);
  const from = parseString(sp.from); // YYYY-MM-DD
  const to = parseString(sp.to);
  const includeDeleted = sp.deleted === "1";
  const limit = parseLimit(sp.limit);

  const supabase = await createClient();

  // Membres pour le sélecteur
  const { data: membres } = await supabase
    .from("membres")
    .select("id, prenom, nom")
    .eq("caisse_id", caisseId)
    .order("nom")
    .order("prenom");

  const fromIso = from ? `${from}T00:00:00Z` : null;
  const toIso = to ? `${to}T23:59:59Z` : null;

  // Construction des requêtes selon la tab
  const wantAmendes = tab === "toutes" || tab === "amendes";
  const wantPaiements = tab === "toutes" || tab === "paiements";
  const wantRetraits = tab === "toutes" || tab === "retraits";

  const amendesQ = wantAmendes
    ? (() => {
        let q = supabase
          .from("amendes")
          .select(
            "id, caisse_id, membre_id, motif_id, libelle, montant_centimes, jour_match, declaree_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(id, prenom, nom)",
          )
          .eq("caisse_id", caisseId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (membreFilter) q = q.eq("membre_id", membreFilter);
        if (fromIso) q = q.gte("created_at", fromIso);
        if (toIso) q = q.lte("created_at", toIso);
        if (!includeDeleted) q = q.is("supprimee_at", null);
        return q;
      })()
    : null;

  const paiementsQ = wantPaiements
    ? (() => {
        let q = supabase
          .from("paiements")
          .select(
            "id, caisse_id, membre_id, montant_centimes, moyen, enregistre_par_user_id, supprimee_at, supprimee_par_user_id, motif_suppression, created_at, membres(id, prenom, nom)",
          )
          .eq("caisse_id", caisseId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (membreFilter) q = q.eq("membre_id", membreFilter);
        if (fromIso) q = q.gte("created_at", fromIso);
        if (toIso) q = q.lte("created_at", toIso);
        if (!includeDeleted) q = q.is("supprimee_at", null);
        return q;
      })()
    : null;

  const retraitsQ = wantRetraits
    ? (() => {
        let q = supabase
          .from("retraits")
          .select(
            "id, caisse_id, libelle, montant_centimes, enregistre_par_user_id, created_at",
          )
          .eq("caisse_id", caisseId)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (fromIso) q = q.gte("created_at", fromIso);
        if (toIso) q = q.lte("created_at", toIso);
        // Pas de filtre membre sur retraits (pas lié à un membre)
        return q;
      })()
    : null;

  const [amendesRes, paiementsRes, retraitsRes] = await Promise.all([
    amendesQ ?? Promise.resolve({ data: [] as never[] }),
    paiementsQ ?? Promise.resolve({ data: [] as never[] }),
    retraitsQ ?? Promise.resolve({ data: [] as never[] }),
  ]);

  // Collecte des user ids pour résolution email (déclarants + suppresseurs)
  const userIds = new Set<string>();
  for (const a of amendesRes.data ?? []) {
    if (a.declaree_par_user_id) userIds.add(a.declaree_par_user_id);
    if (a.supprimee_par_user_id) userIds.add(a.supprimee_par_user_id);
  }
  for (const p of paiementsRes.data ?? []) {
    if (p.enregistre_par_user_id) userIds.add(p.enregistre_par_user_id);
    if (p.supprimee_par_user_id) userIds.add(p.supprimee_par_user_id);
  }
  for (const r of retraitsRes.data ?? []) {
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

  // Merge unifié
  const items: EcritureItem[] = [];

  for (const a of amendesRes.data ?? []) {
    const m = (a.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    items.push({
      type: "amende",
      id: a.id,
      caisseId: a.caisse_id,
      createdAt: a.created_at,
      montantCentimes: a.montant_centimes,
      libelle: a.libelle,
      membreNom: m ? `${m.prenom} ${m.nom}` : "(membre supprimé)",
      moyen: null,
      jourMatch: a.jour_match,
      acteurEmail: emailById.get(a.declaree_par_user_id) ?? a.declaree_par_user_id.slice(0, 8),
      supprimeeAt: a.supprimee_at,
      motifSuppression: a.motif_suppression,
      suppresseurEmail: a.supprimee_par_user_id
        ? emailById.get(a.supprimee_par_user_id) ?? a.supprimee_par_user_id.slice(0, 8)
        : null,
    });
  }
  for (const p of paiementsRes.data ?? []) {
    const m = (p.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    items.push({
      type: "paiement",
      id: p.id,
      caisseId: p.caisse_id,
      createdAt: p.created_at,
      montantCentimes: p.montant_centimes,
      libelle: m ? `Paiement ${m.prenom} ${m.nom}` : "Paiement",
      membreNom: m ? `${m.prenom} ${m.nom}` : "(membre supprimé)",
      moyen: p.moyen,
      jourMatch: false,
      acteurEmail: emailById.get(p.enregistre_par_user_id) ?? p.enregistre_par_user_id.slice(0, 8),
      supprimeeAt: p.supprimee_at,
      motifSuppression: p.motif_suppression,
      suppresseurEmail: p.supprimee_par_user_id
        ? emailById.get(p.supprimee_par_user_id) ?? p.supprimee_par_user_id.slice(0, 8)
        : null,
    });
  }
  for (const r of retraitsRes.data ?? []) {
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
  const truncated = items.length >= limit && tab === "toutes";
  const trimmed = items.slice(0, limit);

  // URL builder pour les tabs/charger plus
  const buildUrl = (override: Partial<{ tab: Tab; limit: number }>) => {
    const params = new URLSearchParams();
    params.set("tab", override.tab ?? tab);
    if (membreFilter) params.set("membre", membreFilter);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (includeDeleted) params.set("deleted", "1");
    const l = override.limit ?? limit;
    if (l !== 50) params.set("limit", String(l));
    return `?${params.toString()}`;
  };

  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Écritures
          </h1>
          {!cloturee && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/caisses/${caisseId}/ecritures/amende/new`}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                + Amende
              </Link>
              <Link
                href={`/admin/caisses/${caisseId}/ecritures/paiement/new`}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Paiement
              </Link>
              <Link
                href={`/admin/caisses/${caisseId}/ecritures/retrait/new`}
                className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                + Retrait
              </Link>
            </div>
          )}
        </header>

        {cloturee && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            La caisse est clôturée — lecture seule.
          </div>
        )}

        {/* Tabs */}
        <nav className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {VALID_TABS.map((t) => {
            const active = tab === t;
            const labels: Record<Tab, string> = {
              toutes: "Toutes",
              amendes: "Amendes",
              paiements: "Paiements",
              retraits: "Retraits",
            };
            return (
              <Link
                key={t}
                href={buildUrl({ tab: t, limit: 50 })}
                className={`px-3 py-2 text-sm font-medium ${
                  active
                    ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {labels[t]}
              </Link>
            );
          })}
        </nav>

        <FilterBar
          tab={tab}
          membres={membres ?? []}
          membreId={membreFilter}
          from={from}
          to={to}
          includeDeleted={includeDeleted}
        />

        <EcrituresList items={trimmed} readOnly={cloturee} />

        {trimmed.length === 0 && (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucune écriture ne correspond aux filtres.
          </div>
        )}

        {truncated && (
          <div className="flex justify-center">
            <Link
              href={buildUrl({ limit: limit + 50 })}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Charger plus
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
