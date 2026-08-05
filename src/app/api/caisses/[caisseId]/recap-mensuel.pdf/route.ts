// Route Handler : export PDF du récapitulatif mensuel par membre.
//
// GET /api/caisses/[caisseId]/recap-mensuel.pdf?mois=YYYY-MM
//
// Garde : requireCaisseAdmin → tout admin / créateur / super-admin de la
// caisse peut télécharger.
//
// Renvoie un application/pdf en attachment.

import { NextResponse } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCaisseAdmin } from "@/lib/auth/guard-caisse";
import { RecapMensuel, type MembreMoisLigne, type RecapMensuelData } from "@/lib/pdf/RecapMensuel";

// Doit tourner en Node.js (pdfkit / fontkit incompatibles avec Edge).
export const runtime = "nodejs";
// Toujours dynamique (auth + données fraîches).
export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "caisse"
  );
}

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caisseId: string }> },
) {
  const { caisseId } = await params;
  const ctx = await requireCaisseAdmin(caisseId);

  const url = new URL(request.url);
  const moisParam = url.searchParams.get("mois") ?? "";
  const mois = /^\d{4}-\d{2}$/.test(moisParam) ? moisParam : currentMonthDefault();

  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("situation_caisse_mois", {
    p_caisse_id: caisseId,
    p_mois: `${mois}-01`,
  });

  const sorted = [...(rows ?? [])].sort((a, b) => {
    if (b.montant_a_payer_centimes !== a.montant_a_payer_centimes) {
      return b.montant_a_payer_centimes - a.montant_a_payer_centimes;
    }
    return a.prenom.localeCompare(b.prenom);
  });

  const membres: MembreMoisLigne[] = sorted.map((r) => ({
    prenom: r.prenom,
    nom: r.nom,
    actif: r.actif,
    soldeAvantCentimes: r.solde_avant_centimes,
    amendesMoisCentimes: r.amendes_mois_centimes,
    paiementsMoisCentimes: r.paiements_mois_centimes,
    montantAPayerCentimes: r.montant_a_payer_centimes,
    avanceCentimes: r.avance_centimes,
  }));

  const admin = createAdminClient();
  const { data: usersList } = await admin.auth.admin.listUsers({ perPage: 200 });
  const parEmail =
    usersList?.users.find((u) => u.id === ctx.userId)?.email ?? null;

  const data: RecapMensuelData = {
    caisse: { nom: ctx.caisse.nom, code: ctx.caisse.code },
    moisLabel: moisLabel(mois),
    generation: { at: new Date().toISOString(), parEmail },
    totaux: {
      amendesMoisCentimes: membres.reduce((s, m) => s + m.amendesMoisCentimes, 0),
      aPayerCentimes: membres.reduce((s, m) => s + m.montantAPayerCentimes, 0),
      avanceCentimes: membres.reduce((s, m) => s + m.avanceCentimes, 0),
    },
    membres,
  };

  const element = createElement(RecapMensuel, { data }) as unknown as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const slug = slugify(ctx.caisse.nom);
  const filename = `caisse-${slug}-recap-${mois}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
