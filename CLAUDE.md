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

```
caisse-noire/
├── src/
│   ├── app/
│   │   ├── (admin)/          # Routes protégées Supabase Auth (créateur + admin)
│   │   ├── (membre)/         # Routes protégées par code caisse + mdp hashé
│   │   ├── api/
│   │   │   └── ping/         # Cron keep-alive Supabase (5 jours)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/               # shadcn/ui primitives — ne pas éditer manuellement
│   │   └── features/         # Composants métier, un par fichier
│   └── lib/
│       ├── supabase/         # Clients browser / server / admin + types générés
│       └── utils.ts          # Helpers purs (cn, formatters…)
├── public/
├── .env.local.example        # Variables requises, sans valeurs
├── components.json           # Config shadcn
├── vercel.json               # Cron keep-alive
└── tsconfig.json
```

## Rôles et accès

| Rôle       | Auth                                                        | Peut faire                                                                 |
|------------|-------------------------------------------------------------|----------------------------------------------------------------------------|
| Créateur   | Supabase Auth                                               | Tout, y compris clôture de caisse et suppression                           |
| Admin      | Supabase Auth                                               | Tout sauf clôture et suppression                                           |
| Membre     | Code caisse + mot de passe (hashé SHA-256 côté client)      | Consultation, déclaration amendes, paiement. Session en `sessionStorage`.  |

**Alternative recommandée** : bcrypt via Edge Function plutôt que SHA-256 client (plus sûr). Voir CDC 8.4.

## Conventions de nommage

- **Fichiers TSX** : `PascalCase.tsx` pour les composants (`AmendeCard.tsx`), `kebab-case.ts` pour le reste (`supabase-server.ts`).
- **Dossiers** : `kebab-case` (`lib/supabase/`), sauf route groups Next (`(admin)`, `(membre)`).
- **Tables Supabase** : `snake_case` au pluriel (`caisses`, `membres`, `amendes`, `retraits`).
- **Colonnes** : `snake_case` (`created_at`, `montant_centimes`).
- **Types TS générés** : importés depuis `@/lib/supabase/types`.
- **Server actions** : suffixe `Action` (`paierAmendeAction`).
- **Fonctions SQL** : `snake_case`, préfixe selon intention (`is_admin_of`, `get_solde_caisse`).

## Montants

Toujours stockés en **centimes (SMALLINT ou INTEGER)**, jamais en flottant.
Formatage UI : helper `formatEuros(centimes)` → `"12,34 €"`.

## Commandes utiles

```bash
npm run dev          # Dev server
npm run build        # Build prod
npm run lint         # ESLint
npx tsc --noEmit     # Typecheck
```

## Phases de déploiement

1. ✅ **Setup** — Next, Tailwind, shadcn, structure, configs.
2. **DB Supabase** — Schéma, migrations, RLS, types TS générés.
3. **Architecture** — Clients Supabase, AuthContext, layouts, thème.
4. **Features** — Login → Dashboard → Admin → Amendes → Paiements → Historique → Clôture.
5. **Polish** — Palette finale, perf mobile, tests, domaine custom.

## Contraintes infra à ne pas oublier

- Supabase free : pause après 7 jours d'inactivité → **cron keep-alive** `/api/ping` toutes les 5 jours (`vercel.json`).
- Vercel Hobby : lambda 50 Mo → **pas de Puppeteer**, utiliser `@react-pdf/renderer`.
- 500 Mo DB / 2 Go bande mensuelle — rester sobre sur les images et les requêtes.
