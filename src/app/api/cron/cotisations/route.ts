// Cron mensuel (vercel.json) : matérialise la cotisation du mois qui vient
// de se clore en vraies lignes `amendes`, pour chaque caisse cotisation_active.
// Voir supabase/migrations/20260903100000_cotisation_materialisee.sql —
// generer_cotisations_mois() est idempotente (ON CONFLICT DO NOTHING), un
// rejeu de ce cron ne crée jamais de doublon.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function moisPrecedentParis(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const annee = Number(parts.find((p) => p.type === "year")!.value);
  const moisCourant1Indexe = Number(parts.find((p) => p.type === "month")!.value);
  // Date.UTC normalise un index de mois négatif (ex. janvier -> mois=1 ->
  // -1) en décembre de l'année précédente, donc pas de cas particulier ici.
  const moisPrecedent = new Date(Date.UTC(annee, moisCourant1Indexe - 2, 1));
  return moisPrecedent.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const pMois = moisPrecedentParis();

  const { data: caisses, error: caissesError } = await supabase
    .from("caisses")
    .select("id, nom")
    .eq("cotisation_active", true);

  if (caissesError) {
    return NextResponse.json({ ok: false, error: caissesError.message }, { status: 502 });
  }

  const resultats = [];
  for (const caisse of caisses ?? []) {
    const { data, error } = await supabase.rpc("generer_cotisations_mois", {
      p_caisse_id: caisse.id,
      p_mois: pMois,
    });
    resultats.push({
      caisse_id: caisse.id,
      nom: caisse.nom,
      lignes_generees: error ? null : data,
      error: error?.message ?? null,
    });
  }

  return NextResponse.json({ ok: true, mois: pMois, resultats });
}
