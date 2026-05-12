"use client";

// Dashboard membre — Phase 4.C.
//
// Données (toutes filtrées par RLS via JWT custom) :
//   - mon solde et mes totaux (v_membre_situation)
//   - solde caisse global (v_caisse_solde)
//   - top 3 des plus gros payeurs (v_membre_situation order paiements desc)
//   - soldes par membre — uniquement solde, pour transparence (point 4 = b)
//   - mes amendes (5 dernières) + mes paiements (5 derniers)
//   - retraits de la caisse (transparence — point 6)
//   - lien changer mot de passe

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMembreAuth } from "@/lib/auth/membre-context";
import { formatEuros, formatSolde } from "@/lib/format";

type Situation = {
  membre_id: string | null;
  total_amendes_centimes: number | null;
  total_paiements_centimes: number | null;
  solde_centimes: number | null;
  prenom: string;
  nom: string;
  actif: boolean;
};

type Amende = {
  id: string;
  libelle: string;
  montant_centimes: number;
  created_at: string;
};

type Paiement = {
  id: string;
  montant_centimes: number;
  moyen: "especes" | "virement" | "autre";
  created_at: string;
};

type Retrait = {
  id: string;
  libelle: string;
  montant_centimes: number;
  created_at: string;
};

type Data = {
  caisseNom: string;
  caisseCode: string;
  moi: { prenom: string; nom: string } | null;
  monSolde: number;
  monTotalAmendes: number;
  monTotalPaiements: number;
  soldeCaisse: number;
  situations: Situation[];
  amendes: Amende[];
  paiements: Paiement[];
  retraits: Retrait[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

const MOYEN_LABEL: Record<Paiement["moyen"], string> = {
  especes: "espèces",
  virement: "virement",
  autre: "autre",
};

export default function MembreDashboardPage() {
  const { supabase, claims } = useMembreAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [caisseRes, moiRes, situationsRes, soldeRes, amendesRes, paiementsRes, retraitsRes] =
          await Promise.all([
            supabase
              .from("caisses")
              .select("nom, code")
              .eq("id", claims.caisse_id)
              .maybeSingle(),
            supabase
              .from("membres")
              .select("prenom, nom")
              .eq("id", claims.membre_id)
              .maybeSingle(),
            supabase
              .from("v_membre_situation")
              .select(
                "membre_id, total_amendes_centimes, total_paiements_centimes, solde_centimes, membres!inner(prenom, nom, actif)",
              )
              .eq("caisse_id", claims.caisse_id),
            supabase
              .from("v_caisse_solde")
              .select("solde_centimes")
              .eq("caisse_id", claims.caisse_id)
              .maybeSingle(),
            supabase
              .from("amendes")
              .select("id, libelle, montant_centimes, created_at")
              .eq("caisse_id", claims.caisse_id)
              .eq("membre_id", claims.membre_id)
              .is("supprimee_at", null)
              .order("created_at", { ascending: false })
              .limit(20),
            supabase
              .from("paiements")
              .select("id, montant_centimes, moyen, created_at")
              .eq("caisse_id", claims.caisse_id)
              .eq("membre_id", claims.membre_id)
              .is("supprimee_at", null)
              .order("created_at", { ascending: false })
              .limit(20),
            supabase
              .from("retraits")
              .select("id, libelle, montant_centimes, created_at")
              .eq("caisse_id", claims.caisse_id)
              .order("created_at", { ascending: false })
              .limit(20),
          ]);

        if (cancelled) return;

        const situationsRaw = (situationsRes.data ?? []) as unknown as {
          membre_id: string | null;
          total_amendes_centimes: number | null;
          total_paiements_centimes: number | null;
          solde_centimes: number | null;
          membres: { prenom: string; nom: string; actif: boolean } | null;
        }[];

        const situations: Situation[] = situationsRaw
          .filter((r) => r.membres !== null)
          .map((r) => ({
            membre_id: r.membre_id,
            total_amendes_centimes: r.total_amendes_centimes,
            total_paiements_centimes: r.total_paiements_centimes,
            solde_centimes: r.solde_centimes,
            prenom: r.membres!.prenom,
            nom: r.membres!.nom,
            actif: r.membres!.actif,
          }));

        const mySit = situations.find((s) => s.membre_id === claims.membre_id);

        setData({
          caisseNom: caisseRes.data?.nom ?? "—",
          caisseCode: caisseRes.data?.code ?? "—",
          moi: moiRes.data ?? null,
          monSolde: mySit?.solde_centimes ?? 0,
          monTotalAmendes: mySit?.total_amendes_centimes ?? 0,
          monTotalPaiements: mySit?.total_paiements_centimes ?? 0,
          soldeCaisse: soldeRes.data?.solde_centimes ?? 0,
          situations,
          amendes: (amendesRes.data ?? []) as Amende[],
          paiements: (paiementsRes.data ?? []) as Paiement[],
          retraits: (retraitsRes.data ?? []) as Retrait[],
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur de chargement");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, claims.caisse_id, claims.membre_id]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Chargement…
      </div>
    );
  }

  const top3Payeurs = [...data.situations]
    .filter((s) => (s.total_paiements_centimes ?? 0) > 0)
    .sort((a, b) => (b.total_paiements_centimes ?? 0) - (a.total_paiements_centimes ?? 0))
    .slice(0, 3);

  const soldesAutres = [...data.situations]
    .filter((s) => s.membre_id !== claims.membre_id)
    .sort((a, b) => (b.solde_centimes ?? 0) - (a.solde_centimes ?? 0));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Header --------------------------------------------------------- */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Bienvenue{data.moi ? `, ${data.moi.prenom}` : ""}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Caisse : <span className="font-medium">{data.caisseNom}</span>{" "}
          <span className="font-mono text-xs text-zinc-500">({data.caisseCode})</span>
        </p>
      </header>

      {/* Mon solde ------------------------------------------------------ */}
      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Mon solde
        </div>
        <div
          className={`mt-1 font-mono text-3xl font-semibold ${
            data.monSolde > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : data.monSolde < 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-700 dark:text-zinc-300"
          }`}
        >
          {formatSolde(data.monSolde)}
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {data.monSolde > 0
            ? "Avance reportée pour les prochaines amendes."
            : data.monSolde < 0
              ? "Vous avez une dette à régler."
              : "Compte à zéro."}
        </p>
        <div className="mt-4 flex gap-6 text-xs text-zinc-600 dark:text-zinc-400">
          <span>
            Amendes :{" "}
            <span className="font-mono text-red-600 dark:text-red-400">
              {formatEuros(data.monTotalAmendes)}
            </span>
          </span>
          <span>
            Paiements :{" "}
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              {formatEuros(data.monTotalPaiements)}
            </span>
          </span>
        </div>
      </section>

      {/* Solde caisse + top 3 ----------------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Solde de la caisse
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {formatSolde(data.soldeCaisse)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Top 3 payeurs
          </div>
          {top3Payeurs.length === 0 ? (
            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Aucun paiement.</div>
          ) : (
            <ol className="mt-1 space-y-0.5 text-sm">
              {top3Payeurs.map((p, i) => (
                <li
                  key={p.membre_id}
                  className="flex items-center justify-between text-zinc-700 dark:text-zinc-300"
                >
                  <span>
                    <span className="mr-1 inline-block w-4 text-zinc-500 dark:text-zinc-400">
                      {i + 1}.
                    </span>
                    {p.prenom} {p.nom}
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatEuros(p.total_paiements_centimes ?? 0)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Mes amendes / mes paiements ---------------------------------- */}
      <section className="grid gap-3 sm:grid-cols-2">
        <ListBlock
          title="Mes amendes"
          empty="Aucune amende."
          rows={data.amendes.slice(0, 5).map((a) => ({
            key: a.id,
            primary: a.libelle,
            secondary: formatDate(a.created_at),
            amount: -a.montant_centimes,
          }))}
          fullCount={data.amendes.length}
        />
        <ListBlock
          title="Mes paiements"
          empty="Aucun paiement."
          rows={data.paiements.slice(0, 5).map((p) => ({
            key: p.id,
            primary: MOYEN_LABEL[p.moyen],
            secondary: formatDate(p.created_at),
            amount: p.montant_centimes,
          }))}
          fullCount={data.paiements.length}
        />
      </section>

      {/* Soldes des autres membres ------------------------------------ */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Soldes des autres membres
        </h2>
        {soldesAutres.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Vous êtes le seul membre.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {soldesAutres.map((s) => (
              <li
                key={s.membre_id}
                className={`flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900 ${
                  s.actif ? "" : "opacity-60"
                }`}
              >
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {s.prenom} {s.nom}
                </span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    (s.solde_centimes ?? 0) > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : (s.solde_centimes ?? 0) < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500"
                  }`}
                >
                  {formatSolde(s.solde_centimes ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Retraits de la caisse ---------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Retraits récents de la caisse
        </h2>
        {data.retraits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            Aucun retrait.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {data.retraits.slice(0, 10).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span className="text-zinc-500 dark:text-zinc-400">{formatDate(r.created_at)}</span>
                <span className="flex-1 truncate text-zinc-800 dark:text-zinc-200">
                  {r.libelle}
                </span>
                <span
                  className={`font-mono ${
                    r.montant_centimes >= 0
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-zinc-500"
                  }`}
                >
                  {formatSolde(-r.montant_centimes)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-2">
        <Link
          href="/membre/change-password"
          className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Changer mon mot de passe
        </Link>
      </section>
    </div>
  );
}

function ListBlock({
  title,
  empty,
  rows,
  fullCount,
}: {
  title: string;
  empty: string;
  rows: { key: string; primary: string; secondary: string; amount: number }[];
  fullCount: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-2 py-1.5 text-xs"
              >
                <span className="flex-1 truncate text-zinc-700 dark:text-zinc-300">
                  {r.primary}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">{r.secondary}</span>
                <span
                  className={`font-mono ${
                    r.amount > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : r.amount < 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500"
                  }`}
                >
                  {formatSolde(r.amount)}
                </span>
              </li>
            ))}
          </ul>
          {fullCount > rows.length && (
            <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
              {fullCount - rows.length} de plus
            </p>
          )}
        </>
      )}
    </div>
  );
}
