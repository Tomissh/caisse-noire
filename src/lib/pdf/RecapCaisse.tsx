// Composant PDF du récapitulatif d'une caisse (Phase 4.E).
//
// Produit un document A4 portrait minimal (Helvetica par défaut), consommé
// par la route /api/caisses/[caisseId]/recap.pdf.
//
// Charte : noir / blanc / gris, pas d'emoji, FR. Si la caisse n'est pas
// clôturée, un bandeau "Aperçu" est rendu en en-tête.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatEuros, formatSolde } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MembreLigne = {
  nom: string;
  actif: boolean;
  totalAmendesCentimes: number;
  totalPaiementsCentimes: number;
  soldeCentimes: number;
};

export type EcritureLigne = {
  date: string; // ISO
  libelle: string;
  membreNom: string | null;
  moyen: string | null;
  montantCentimes: number;
  acteurEmail: string | null;
  supprimee: boolean;
  motifSuppression: string | null;
};

export type RecapData = {
  caisse: {
    nom: string;
    code: string;
    description: string | null;
    createdAt: string;
    clotureeAt: string | null;
  };
  generation: {
    at: string;
    parEmail: string | null;
    includeDeleted: boolean;
  };
  kpis: {
    soldeCentimes: number;
    totalAmendesCentimes: number;
    totalPaiementsCentimes: number;
    totalRetraitsCentimes: number;
    nbMembresActifs: number;
  };
  membres: MembreLigne[];
  retraits: EcritureLigne[];
  amendes: EcritureLigne[];
  paiements: EcritureLigne[];
};

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MOYEN_LABEL: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  autre: "Autre",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const COLORS = {
  black: "#111111",
  text: "#1f1f1f",
  muted: "#6b6b6b",
  faint: "#a0a0a0",
  border: "#cccccc",
  zebra: "#f6f6f6",
  warning: "#a36500",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    fontSize: 9,
    color: COLORS.text,
    fontFamily: "Helvetica",
  },

  header: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 700, color: COLORS.black },
  subtitle: { fontSize: 10, color: COLORS.muted, marginTop: 2 },
  apercuBadge: {
    marginTop: 6,
    padding: 4,
    fontSize: 9,
    color: COLORS.warning,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderStyle: "solid",
  },

  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    marginBottom: 8,
  },
  metaItem: { width: "50%", marginBottom: 2 },
  metaLabel: { color: COLORS.muted, fontSize: 8 },
  metaValue: { fontSize: 9, color: COLORS.text },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: COLORS.black,
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
    paddingBottom: 2,
  },

  kpiRow: { flexDirection: "row", marginTop: 4 },
  kpiCell: {
    flex: 1,
    padding: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "solid",
    marginRight: 4,
  },
  kpiCellLast: { marginRight: 0 },
  kpiLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase" },
  kpiValue: { fontSize: 11, fontWeight: 700, color: COLORS.black, marginTop: 2 },

  table: { marginTop: 4 },
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
  },
  trHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.black,
    borderBottomStyle: "solid",
  },
  trZebra: {
    flexDirection: "row",
    backgroundColor: COLORS.zebra,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    borderBottomStyle: "solid",
  },
  th: {
    paddingVertical: 4,
    paddingHorizontal: 3,
    fontSize: 8,
    fontWeight: 700,
    color: COLORS.black,
  },
  td: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 8,
    color: COLORS.text,
  },
  tdRight: { textAlign: "right" },
  tdDeleted: { color: COLORS.faint, textDecoration: "line-through" },

  empty: {
    padding: 8,
    fontSize: 8,
    color: COLORS.muted,
    fontStyle: "italic",
  },

  motifLine: {
    paddingHorizontal: 3,
    paddingBottom: 3,
    fontSize: 7,
    color: COLORS.muted,
    fontStyle: "italic",
  },

  pageNumber: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: COLORS.faint,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function Kpi({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.kpiCell, ...(last ? [styles.kpiCellLast] : [])]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function MembresTable({ rows }: { rows: MembreLigne[] }) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>Aucun membre.</Text>;
  }
  // Tri : solde décroissant (créditeurs en haut, dettes en bas)
  const sorted = [...rows].sort((a, b) => b.soldeCentimes - a.soldeCentimes);
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        <Text style={[styles.th, { flex: 3 }]}>Membre</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Total amendes</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Total paiements</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Solde</Text>
      </View>
      {sorted.map((m, i) => (
        <View key={`${m.nom}-${i}`} style={i % 2 === 0 ? styles.tr : styles.trZebra}>
          <Text style={[styles.td, { flex: 3 }]}>
            {m.nom}
            {!m.actif ? " (désactivé)" : ""}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatEuros(m.totalAmendesCentimes)}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatEuros(m.totalPaiementsCentimes)}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatSolde(m.soldeCentimes)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RetraitsTable({ rows }: { rows: EcritureLigne[] }) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>Aucun retrait.</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        <Text style={[styles.th, { flex: 2 }]}>Date</Text>
        <Text style={[styles.th, { flex: 5 }]}>Libellé</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Montant</Text>
        <Text style={[styles.th, { flex: 3 }]}>Par</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={i % 2 === 0 ? styles.tr : styles.trZebra}>
          <Text style={[styles.td, { flex: 2 }]}>{formatDate(r.date)}</Text>
          <Text style={[styles.td, { flex: 5 }]}>{r.libelle}</Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatEuros(r.montantCentimes)}
          </Text>
          <Text style={[styles.td, { flex: 3 }]}>{r.acteurEmail ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}

function EcrituresTable({ rows, showMoyen }: { rows: EcritureLigne[]; showMoyen: boolean }) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>Aucune ligne.</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        <Text style={[styles.th, { flex: 2 }]}>Date</Text>
        <Text style={[styles.th, { flex: 3 }]}>Membre</Text>
        <Text style={[styles.th, { flex: showMoyen ? 3 : 4 }]}>Libellé</Text>
        {showMoyen && <Text style={[styles.th, { flex: 1.5 }]}>Moyen</Text>}
        <Text style={[styles.th, { flex: 1.8, textAlign: "right" }]}>Montant</Text>
        <Text style={[styles.th, { flex: 3 }]}>Par</Text>
      </View>
      {rows.map((r, i) => {
        const tdBase = r.supprimee ? [styles.td, styles.tdDeleted] : [styles.td];
        return (
          <View key={i} wrap={false}>
            <View style={i % 2 === 0 ? styles.tr : styles.trZebra}>
              <Text style={[...tdBase, { flex: 2 }]}>{formatDate(r.date)}</Text>
              <Text style={[...tdBase, { flex: 3 }]}>{r.membreNom ?? "—"}</Text>
              <Text style={[...tdBase, { flex: showMoyen ? 3 : 4 }]}>{r.libelle}</Text>
              {showMoyen && (
                <Text style={[...tdBase, { flex: 1.5 }]}>
                  {r.moyen ? MOYEN_LABEL[r.moyen] ?? r.moyen : "—"}
                </Text>
              )}
              <Text style={[...tdBase, styles.tdRight, { flex: 1.8 }]}>
                {formatEuros(r.montantCentimes)}
              </Text>
              <Text style={[...tdBase, { flex: 3 }]}>{r.acteurEmail ?? "—"}</Text>
            </View>
            {r.supprimee && r.motifSuppression && (
              <Text style={styles.motifLine}>Supprimée — motif : {r.motifSuppression}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function RecapCaisse({ data }: { data: RecapData }) {
  const { caisse, generation, kpis, membres, retraits, amendes, paiements } = data;
  const isCloturee = caisse.clotureeAt !== null;
  const periode = isCloturee
    ? `Du ${formatDate(caisse.createdAt)} au ${formatDate(caisse.clotureeAt!)}`
    : `Ouverte depuis le ${formatDate(caisse.createdAt)}`;

  return (
    <Document
      title={`Récapitulatif caisse — ${caisse.nom}`}
      author={generation.parEmail ?? "Caisse Noire"}
    >
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Récapitulatif — {caisse.nom}</Text>
          <Text style={styles.subtitle}>{periode}</Text>
          {!isCloturee && (
            <Text style={styles.apercuBadge}>
              APERÇU — la caisse est encore ouverte. Ce document peut évoluer.
            </Text>
          )}
        </View>

        {/* Méta */}
        <View style={styles.metaGrid}>
          <Meta label="Code caisse" value={caisse.code} />
          <Meta
            label="Statut"
            value={isCloturee ? `Clôturée le ${formatDate(caisse.clotureeAt!)}` : "Ouverte"}
          />
          <Meta label="Généré le" value={formatDateTime(generation.at)} />
          <Meta label="Généré par" value={generation.parEmail ?? "—"} />
          {caisse.description && <Meta label="Description" value={caisse.description} />}
          <Meta
            label="Écritures supprimées"
            value={generation.includeDeleted ? "Incluses" : "Exclues"}
          />
        </View>

        {/* KPIs */}
        <Text style={styles.sectionTitle}>Synthèse</Text>
        <View style={styles.kpiRow}>
          <Kpi label="Solde caisse" value={formatSolde(kpis.soldeCentimes)} />
          <Kpi label="Total amendes" value={formatEuros(kpis.totalAmendesCentimes)} />
          <Kpi label="Total paiements" value={formatEuros(kpis.totalPaiementsCentimes)} />
          <Kpi label="Total retraits" value={formatEuros(kpis.totalRetraitsCentimes)} />
          <Kpi
            label="Membres actifs"
            value={String(kpis.nbMembresActifs)}
            last
          />
        </View>

        {/* Soldes par membre */}
        <Text style={styles.sectionTitle}>Soldes par membre</Text>
        <MembresTable rows={membres} />

        {/* Retraits */}
        <Text style={styles.sectionTitle}>Retraits ({retraits.length})</Text>
        <RetraitsTable rows={retraits} />

        {/* Amendes */}
        <Text style={styles.sectionTitle}>Amendes ({amendes.length})</Text>
        <EcrituresTable rows={amendes} showMoyen={false} />

        {/* Paiements */}
        <Text style={styles.sectionTitle}>Paiements ({paiements.length})</Text>
        <EcrituresTable rows={paiements} showMoyen />

        {/* Pied de page */}
        <View style={styles.pageNumber} fixed>
          <Text>
            {caisse.nom} — généré le {formatDateTime(generation.at)}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
