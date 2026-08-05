// Composant PDF du récapitulatif mensuel par membre.
//
// Montre, pour un mois donné, ce que chaque membre doit encore payer en
// tenant compte de son solde reporté (avance/retard des mois précédents).
// Consommé par /api/caisses/[caisseId]/recap-mensuel.pdf.
//
// Charte : identique à RecapCaisse (noir / blanc / gris, FR, pas d'emoji).

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatEuros, formatSolde } from "@/lib/format";

export type MembreMoisLigne = {
  prenom: string;
  nom: string;
  actif: boolean;
  soldeAvantCentimes: number;
  amendesMoisCentimes: number;
  paiementsMoisCentimes: number;
  montantAPayerCentimes: number;
  avanceCentimes: number;
};

export type RecapMensuelData = {
  caisse: { nom: string; code: string };
  moisLabel: string;
  generation: { at: string; parEmail: string | null };
  totaux: {
    amendesMoisCentimes: number;
    aPayerCentimes: number;
    avanceCentimes: number;
  };
  membres: MembreMoisLigne[];
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COLORS = {
  black: "#111111",
  text: "#1f1f1f",
  muted: "#6b6b6b",
  faint: "#a0a0a0",
  border: "#cccccc",
  zebra: "#f6f6f6",
  danger: "#a32020",
  ok: "#1f7a4d",
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

  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, marginBottom: 8 },
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
  th: { paddingVertical: 4, paddingHorizontal: 3, fontSize: 8, fontWeight: 700, color: COLORS.black },
  td: { paddingVertical: 3, paddingHorizontal: 3, fontSize: 8, color: COLORS.text },
  tdRight: { textAlign: "right" },
  tdDanger: { color: COLORS.danger, fontWeight: 700 },
  tdOk: { color: COLORS.ok },

  empty: { padding: 8, fontSize: 8, color: COLORS.muted, fontStyle: "italic" },

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

function MembresTable({ rows }: { rows: MembreMoisLigne[] }) {
  if (rows.length === 0) {
    return <Text style={styles.empty}>Aucun membre.</Text>;
  }
  return (
    <View style={styles.table}>
      <View style={styles.trHead}>
        <Text style={[styles.th, { flex: 3 }]}>Membre</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Solde reporté</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Amendes du mois</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>Payé ce mois</Text>
        <Text style={[styles.th, { flex: 2, textAlign: "right" }]}>À payer</Text>
      </View>
      {rows.map((m, i) => (
        <View key={`${m.prenom}-${m.nom}-${i}`} style={i % 2 === 0 ? styles.tr : styles.trZebra}>
          <Text style={[styles.td, { flex: 3 }]}>
            {m.prenom} {m.nom}
            {!m.actif ? " (désactivé)" : ""}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatSolde(m.soldeAvantCentimes)}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatEuros(m.amendesMoisCentimes)}
          </Text>
          <Text style={[styles.td, styles.tdRight, { flex: 2 }]}>
            {formatEuros(m.paiementsMoisCentimes)}
          </Text>
          <Text
            style={[
              styles.td,
              styles.tdRight,
              { flex: 2 },
              m.montantAPayerCentimes > 0 ? styles.tdDanger : styles.tdOk,
            ]}
          >
            {m.montantAPayerCentimes > 0
              ? formatEuros(m.montantAPayerCentimes)
              : m.avanceCentimes > 0
                ? `à jour (+${formatEuros(m.avanceCentimes)})`
                : "à jour"}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function RecapMensuel({ data }: { data: RecapMensuelData }) {
  const { caisse, moisLabel, generation, totaux, membres } = data;

  return (
    <Document
      title={`Récapitulatif mensuel — ${caisse.nom} — ${moisLabel}`}
      author={generation.parEmail ?? "Caisse Noire"}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Récapitulatif mensuel — {caisse.nom}</Text>
          <Text style={styles.subtitle}>{moisLabel}</Text>
        </View>

        <View style={styles.metaGrid}>
          <Meta label="Code caisse" value={caisse.code} />
          <Meta label="Généré le" value={formatDateTime(generation.at)} />
          <Meta label="Généré par" value={generation.parEmail ?? "—"} />
        </View>

        <Text style={styles.sectionTitle}>Synthèse</Text>
        <View style={styles.kpiRow}>
          <Kpi label="Amendes du mois" value={formatEuros(totaux.amendesMoisCentimes)} />
          <Kpi label="Total restant à payer" value={formatEuros(totaux.aPayerCentimes)} />
          <Kpi label="Total en avance" value={formatEuros(totaux.avanceCentimes)} last />
        </View>

        <Text style={styles.sectionTitle}>Détail par membre</Text>
        <MembresTable rows={membres} />

        <View style={styles.pageNumber} fixed>
          <Text>
            {caisse.nom} — généré le {formatDateTime(generation.at)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
