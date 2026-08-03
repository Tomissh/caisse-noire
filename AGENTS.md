@AGENTS.md

# Caisse Noire v2 — Guide Claude Code

App web de gestion de caisse collective pour équipe sportive. Usage privé interne.
Cahier des charges : `C:\Users\tomom\Downloads\cahier_des_charges_caisse_noire.docx`.

## Stack

- **Next.js 16** (App Router, React Server Components, Server Actions)
- **TypeScript strict** (`noUncheckedIndexedAccess` activé)
- **Tailwind CSS v4** + **shadcn/ui** (base `neutral`)
- **next-themes** pour le dark mode (obligatoire, light + dark)
- **Supabase** (Postgres 15 + RLS + Auth) — EU, free tier
- **Vercel Hobby** pour l'hébergement (lambda 50 Mo max)
- **Vitest + Testing Library** pour les tests
- **@react-pdf/renderer** (reco CDC) pour le PDF de clôture

## Règles non négociables (CDC 8.1)

1. **Aucune logique métier dans le frontend.** Tout dans Supabase : fonctions SQL, contraintes, RLS.
2. **Un composant = un fichier.** Livré complet, pas de demi-implémentation.
3. **TypeScript strict.** Jamais de `any`. Tout type venant de la DB vient des types générés Supabase.
4. **Migrations Supabase versionnées.** Jamais de modification manuelle de la DB via le Dashboard.
5. **Retraits immuables.** Pas d'`UPDATE` ni de `DELETE` sur la table `retraits`. Correction = retrait négatif compensatoire.
6. **RLS activée partout.** Vérification systématique avant chaque feature.
7. **SMALLINT castés explicitement côté client** (`Number(x)` ou `parseInt`) — les drivers JS les remontent parfois en string.
8. **Français partout dans l'UI** (libellés, messages d'erreur, emails).
9. **Mobile-first.** Dark mode obligatoire.

## Arborescence
