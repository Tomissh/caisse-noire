---
name: pdf-server-vercel
description: Génération de PDF côté serveur sur Vercel Hobby — choix de lib (react-pdf vs pdf-lib vs Puppeteer), contraintes lambda 50 Mo, route handler Node runtime, streaming, fonts. Trigger sur génération PDF, récapitulatif clôture, app/api/**/pdf/, ou questions sur PDF lib choice.
user-invocable: false
risk: safe
---

# PDF server-side sur Vercel Hobby

Tailored pour **Caisse Noire v2 — récapitulatif de clôture PDF** (CDC 3.2 + 4.6 + 8.4). Usage : un PDF par clôture de caisse, avec tableau des membres, amendes, paiements, solde final.

## When to use
- Route `/api/cloture/[id]/pdf`
- Choix de lib PDF
- Débuggage de layout PDF
- Polices / accents français
- Limites taille lambda Vercel

## Décision : quelle lib ?

| Lib | Taille zippée | Templating | HTML/CSS support | Verdict Caisse Noire |
|---|---|---|---|---|
| `@react-pdf/renderer` | ~2 Mo | Composants React | Non (layout custom) | ✅ **Choix par défaut** |
| `pdf-lib` | ~400 Ko | Imperatif bas-niveau | Non | ⚠️ Pour manipulation / filigrane, pas templating |
| `pdfkit` | ~1 Mo | Imperatif bas-niveau | Non | Alternative à pdf-lib |
| `puppeteer` / `puppeteer-core` + `@sparticuz/chromium` | ~50 Mo | HTML/CSS natif | Oui | ❌ **Dépasse la limite Hobby** en pratique |

**Recommandation : `@react-pdf/renderer`** pour le récapitulatif de clôture.
- Composition React que tu connais déjà.
- Support des polices custom (IBM Plex, Inter, Geist…).
- Pas de Chromium.
- Fonctionne sur Node runtime Vercel Hobby sans drama.

## Squelette route handler

```ts
// app/api/cloture/[id]/pdf/route.ts
import { renderToStream } from "@react-pdf/renderer";
import { ReclamationPDF } from "@/components/pdf/cloture-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";            // react-pdf n'est pas Edge-compatible
export const dynamic = "force-dynamic";
export const maxDuration = 30;              // secondes, Hobby autorise jusqu'à 60

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS garantit l'accès — le Server Component parent a déjà vérifié
  const { data: cloture, error } = await supabase
    .rpc("get_cloture_recap", { p_cloture_id: id });
  if (error || !cloture) return new Response("Not found", { status: 404 });

  const stream = await renderToStream(<ReclamationPDF data={cloture} />);

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="cloture-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

## Composant PDF type

```tsx
// components/pdf/cloture-pdf.tsx
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Inter",
  fonts: [
    { src: "https://rsms.me/inter/font-files/Inter-Regular.woff", fontWeight: 400 },
    { src: "https://rsms.me/inter/font-files/Inter-Bold.woff", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Inter", fontSize: 10 },
  h1: { fontSize: 18, fontWeight: 700, marginBottom: 16 },
  row: { flexDirection: "row", borderBottom: "1 solid #eee", paddingVertical: 4 },
  cellName: { flex: 2 },
  cellMoney: { flex: 1, textAlign: "right" },
});

export function ReclamationPDF({ data }: { data: ClotureRecap }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Caisse Noire — Clôture {data.periode}</Text>
        <View>
          {data.membres.map((m) => (
            <View key={m.id} style={styles.row}>
              <Text style={styles.cellName}>{m.nom}</Text>
              <Text style={styles.cellMoney}>{m.total_amendes.toFixed(2)} €</Text>
              <Text style={styles.cellMoney}>{m.cotisation.toFixed(2)} €</Text>
              <Text style={styles.cellMoney}>{m.paye.toFixed(2)} €</Text>
            </View>
          ))}
        </View>
        <Text>Solde final : {data.solde.toFixed(2)} €</Text>
      </Page>
    </Document>
  );
}
```

## Polices — point crucial

- Sans registration explicite, les caractères accentués peuvent casser. **Toujours registrer une police latine complète** (Inter, Geist, Roboto, IBM Plex Sans…).
- Pour éviter les fetch réseau au runtime : copier les fichiers woff/woff2 dans `public/fonts/` et pointer avec une URL absolue (`process.env.VERCEL_URL`) — ou mieux : **bundler les fonts en base64** dans un module.
- Éviter `Helvetica` par défaut : pas d'accents sur certains viewers.

## Alternative `pdf-lib` (si besoin minimal)

Pour un simple tampon / annotation sur un PDF existant (ex : filigrane), ou quand le layout est ultra-simple :
```ts
import { PDFDocument, StandardFonts } from "pdf-lib";

const doc = await PDFDocument.create();
const page = doc.addPage([595, 842]); // A4 points
const font = await doc.embedFont(StandardFonts.Helvetica);
page.drawText("Clôture caisse", { x: 40, y: 800, size: 18, font });
const bytes = await doc.save();
```

Utilise pdf-lib **uniquement si** :
- Pas de tableaux complexes.
- Pas besoin de templating réactif.
- Contrainte bundle size très stricte.

## Anti-patterns

1. **Puppeteer sur Vercel Hobby** — `@sparticuz/chromium` fait passer à ~50 Mo, tu frôles la limite et le cold start devient douloureux. Possible mais fragile. À réserver à du HTML/CSS complexe impossible à reproduire en react-pdf.
2. **Générer le PDF côté client** — perte du layout typographique contrôlé, sécurité (données sensibles passant par le navigateur) et incompatibilité avec le PDF de clôture "officiel".
3. **Fetch des données dans le composant PDF** — toujours passer les données déjà résolues en props, le rendu PDF doit être synchrone.
4. **Oublier `runtime = "nodejs"`** — react-pdf dépend de `stream` et `fs`, n'est pas Edge-compatible.
5. **Police par défaut avec accents** — résultat imprévisible selon le viewer PDF.

## Sécurité

- La route doit vérifier l'accès via Supabase (le SC parent et/ou un check explicite).
- `Cache-Control: private, no-store` : pas de cache partagé.
- Le PDF peut contenir des données nominatives → même règle RGPD que pour les autres vues.

## Tests

- Un test Vitest peut rendre le composant avec `@react-pdf/renderer` et vérifier le contenu texte via `pdf-parse`.
- E2E Playwright : download + check que c'est bien un PDF valide (magic bytes `%PDF`).
