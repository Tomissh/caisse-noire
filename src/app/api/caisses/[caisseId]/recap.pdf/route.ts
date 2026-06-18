// Route Handler : export PDF du récapitulatif d'une caisse (Phase 4.E).
//
// GET /api/caisses/[caisseId]/recap.pdf?include_deleted=1
//
// Garde : requireCaisseAdmin → tout admin / créateur / super-admin de la
// caisse peut télécharger. Disponible que la caisse soit clôturée ou non
// (aperçu).
//
// Renvoie un application/pdf en attachment ; le nom du fichier est
// composé du slug du nom + date du jour.

import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import {
  RecapCaisse,
  type EcritureLigne,
  type MembreLigne,
  type RecapData,
} from "@/lib/pdf/RecapCaisse";

// Doit tourner en Node.js (pdfkit / fontkit incompatibles avec Edge).
export const runtime = "nodejs";
// Toujours dynamique (auth + données fraîches).
export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "caisse";
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caisseId: string }> },
) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("include_deleted") === "1";

  const supabase = await createClient();

  // ------------------------------------------------------------------------
  // Fetch données — en parallèle
  // ------------------------------------------------------------------------
  const amendesQuery = supabase
    .from("amendes")
    .select(
      "id, libelle, montant_centimes, declaree_par_user_id, supprimee_at, motif_suppression, created_at, membres(prenom, nom)",
    )
    .eq("caisse_id", caisseId)
    .order("created_at", { ascending: true });

  const paiementsQuery = supabase
    .from("paiements")
    .select(
      "id, montant_centimes, moyen, enregistre_par_user_id, supprimee_at, motif_suppression, created_at, membres(prenom, nom)",
    )
    .eq("caisse_id", caisseId)
    .order("created_at", { ascending: true });

  const retraitsQuery = supabase
    .from("retraits")
    .select("id, libelle, montant_centimes, enregistre_par_user_id, created_at")
    .eq("caisse_id", caisseId)
    .order("created_at", { ascending: true });

  const [
    soldeRes,
    membresActifsRes,
    situationsRes,
    amendesRes,
    paiementsRes,
    retraitsRes,
    caisseFullRes,
  ] = await Promise.all([
    supabase.from("v_caisse_solde").select("*").eq("caisse_id", caisseId).maybeSingle(),
    supabase
      .from("membres")
      .select("id", { count: "exact", head: true })
      .eq("caisse_id", caisseId)
      .eq("actif", true),
    supabase
      .from("v_membre_situation")
      .select(
        "membre_id, total_amendes_centimes, total_paiements_centimes, solde_centimes, membres!inner(prenom, nom, actif)",
      )
      .eq("caisse_id", caisseId),
    amendesQuery,
    paiementsQuery,
    retraitsQuery,
    supabase.from("caisses").select("created_at").eq("id", caisseId).maybeSingle(),
  ]);

  // ------------------------------------------------------------------------
  // Filtrage soft-delete selon le paramètre
  // ------------------------------------------------------------------------
  const amendesRows = (amendesRes.data ?? []).filter(
    (r) => includeDeleted || r.supprimee_at === null,
  );
  const paiementsRows = (paiementsRes.data ?? []).filter(
    (r) => includeDeleted || r.supprimee_at === null,
  );

  // ------------------------------------------------------------------------
  // KPIs (somme des écritures NON supprimées — indépendant du include_deleted)
  // ------------------------------------------------------------------------
  const totalAmendes = (amendesRes.data ?? [])
    .filter((r) => r.supprimee_at === null)
    .reduce((s, r) => s + r.montant_centimes, 0);
  const totalPaiements = (paiementsRes.data ?? [])
    .filter((r) => r.supprimee_at === null)
    .reduce((s, r) => s + r.montant_centimes, 0);
  const totalRetraits = (retraitsRes.data ?? []).reduce(
    (s, r) => s + r.montant_centimes,
    0,
  );
  const soldePhysique = soldeRes.data?.solde_centimes ?? totalPaiements - totalRetraits;

  // ------------------------------------------------------------------------
  // Résolution emails des acteurs (1 seul appel listUsers)
  // ------------------------------------------------------------------------
  const userIds = new Set<string>();
  for (const a of amendesRows) {
    if (a.declaree_par_user_id) userIds.add(a.declaree_par_user_id);
  }
  for (const p of paiementsRows) {
    if (p.enregistre_par_user_id) userIds.add(p.enregistre_par_user_id);
  }
  for (const r of retraitsRes.data ?? []) {
    if (r.enregistre_par_user_id) userIds.add(r.enregistre_par_user_id);
  }
  userIds.add(ctx.userId);

  const emailById = new Map<string, string>();
  if (userIds.size > 0) {
    const admin = createAdminClient();
    const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
    for (const u of usersList?.users ?? []) {
      if (u.email && userIds.has(u.id)) emailById.set(u.id, u.email);
    }
  }

  // ------------------------------------------------------------------------
  // Mapping vers RecapData
  // ------------------------------------------------------------------------
  type SituationRow = {
    total_amendes_centimes: number | null;
    total_paiements_centimes: number | null;
    solde_centimes: number | null;
    membres: { prenom: string; nom: string; actif: boolean } | null;
  };
  const membres: MembreLigne[] = (
    (situationsRes.data as unknown as SituationRow[]) ?? []
  )
    .filter((r) => r.membres !== null)
    .map((r) => ({
      prenom: r.membres!.prenom,
      nom: r.membres!.nom,
      actif: r.membres!.actif,
      totalAmendesCentimes: r.total_amendes_centimes ?? 0,
      totalPaiementsCentimes: r.total_paiements_centimes ?? 0,
      soldeCentimes: r.solde_centimes ?? 0,
    }));

  const amendes: EcritureLigne[] = amendesRows.map((a) => {
    const m = (a.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    return {
      date: a.created_at,
      libelle: a.libelle,
      membreNom: m ? `${m.prenom} ${m.nom}` : null,
      moyen: null,
      montantCentimes: a.montant_centimes,
      acteurEmail: emailById.get(a.declaree_par_user_id) ?? null,
      supprimee: a.supprimee_at !== null,
      motifSuppression: a.motif_suppression,
    };
  });

  const paiements: EcritureLigne[] = paiementsRows.map((p) => {
    const m = (p.membres as unknown as { prenom: string; nom: string } | null) ?? null;
    return {
      date: p.created_at,
      libelle: m ? `Paiement ${m.prenom} ${m.nom}` : "Paiement",
      membreNom: m ? `${m.prenom} ${m.nom}` : null,
      moyen: p.moyen,
      montantCentimes: p.montant_centimes,
      acteurEmail: emailById.get(p.enregistre_par_user_id) ?? null,
      supprimee: p.supprimee_at !== null,
      motifSuppression: p.motif_suppression,
    };
  });

  const retraits: EcritureLigne[] = (retraitsRes.data ?? []).map((r) => ({
    date: r.created_at,
    libelle: r.libelle,
    membreNom: null,
    moyen: null,
    montantCentimes: r.montant_centimes,
    acteurEmail: emailById.get(r.enregistre_par_user_id) ?? null,
    supprimee: false,
    motifSuppression: null,
  }));

  const data: RecapData = {
    caisse: {
      nom: ctx.caisse.nom,
      code: ctx.caisse.code,
      description: ctx.caisse.description,
      createdAt: caisseFullRes.data?.created_at ?? new Date().toISOString(),
      clotureeAt: ctx.caisse.cloturee_at,
    },
    generation: {
      at: new Date().toISOString(),
      parEmail: emailById.get(ctx.userId) ?? null,
      includeDeleted,
    },
    kpis: {
      soldeCentimes: soldePhysique,
      totalAmendesCentimes: totalAmendes,
      totalPaiementsCentimes: totalPaiements,
      totalRetraitsCentimes: totalRetraits,
      nbMembresActifs: membresActifsRes.count ?? 0,
    },
    membres,
    retraits,
    amendes,
    paiements,
  };

  // ------------------------------------------------------------------------
  // Rendu PDF
  // ------------------------------------------------------------------------
  // RecapCaisse retourne un <Document>, mais TS ne le voit pas depuis le call
  // site ; on cast pour satisfaire la signature de renderToBuffer.
  const element = createElement(RecapCaisse, { data }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const slug = slugify(ctx.caisse.nom);
  const filename = `caisse-${slug}-${todayStamp()}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
