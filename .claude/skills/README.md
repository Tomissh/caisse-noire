# Skills installés — Caisse Noire v2

18 skills sélectionnés pour la stack **Next.js 15 · TS strict · Tailwind + shadcn/ui · Supabase · Vercel Hobby · Vitest · PDF serveur · mobile-first · dark mode · français**.

## Source
Les 15 premiers viennent du catalogue [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) (clone sparse, non-interactif).
Les 3 derniers sont custom, écrits pour ce projet.

## Skills

### Frontend & UI
| Skill | Rôle |
|---|---|
| `shadcn` | Composants shadcn/ui, CLI, customisation |
| `tailwind-design-system` | Design tokens, production-ready Tailwind |
| `tailwind-patterns` | Tailwind v4, container queries |
| `frontend-ui-dark-ts` | Dark-themed React + Tailwind + Framer Motion |
| `frontend-dev-guidelines` | Standards composants, perfs, features |

### Backend & Data
| Skill | Rôle |
|---|---|
| `backend-dev-guidelines` | Standards routes, controllers, reliability |
| `database` | SQL, migrations, optimisation |
| `database-architect` | Schema modeling, tech selection |

### UX & A11y
| Skill | Rôle |
|---|---|
| `ux-flow` | Flows utilisateur, progressive disclosure |
| `wcag-audit-patterns` | Audit WCAG 2.2, remediation |

### Tests & Déploiement
| Skill | Rôle |
|---|---|
| `testing-patterns` | Vitest, factories, mocking, TDD |
| `e2e-testing-patterns` | E2E reliable suites |
| `awt-e2e-testing` | Playwright + visual matching |
| `github-actions-templates` | CI/CD production-ready |
| `appdeploy` | Déploiement web app |

### Custom (ce projet)
| Skill | Rôle |
|---|---|
| `nextjs-15-app-router` | App Router, Server Components, Server Actions, Vercel Hobby constraints |
| `supabase-rls-postgres` | RLS policies, migrations, types TS, Auth hybride admin/membre, keep-alive |
| `pdf-server-vercel` | Choix lib PDF, react-pdf recommandé, route handler Node runtime |

## Écartés volontairement

- `seo-*` — app privée interne, pas de SEO
- `i18n-localization` — 100% français
- `drizzle-orm-expert` — le CDC impose Supabase client direct, pas Drizzle
- `iconsax-library` — shadcn inclut `lucide-react`, on reste cohérent
- `angular-*`, `swiftui-*`, `building-native-ui` — hors stack
- Skills mobile / desktop natives — hors scope

## Manques du catalogue à considérer plus tard

- Pas de skill spécifique **Vercel Functions / Edge** → couvert en partie par le custom `nextjs-15-app-router`.
- Pas de skill **RGPD / privacy** → à rédiger si nécessaire.
- Pas de skill **observabilité** (Vercel Analytics, Sentry) → pertinent seulement si on dépasse le free tier.

## Comment ajouter un autre skill du catalogue

```bash
# Depuis le repo cloné en /tmp/aas (toujours présent si la session dure)
cp -r /tmp/aas/skills/<nom-skill> .claude/skills/

# Ou re-cloner si nécessaire
git clone --depth=1 --filter=blob:none --sparse https://github.com/sickn33/antigravity-awesome-skills.git /tmp/aas
cd /tmp/aas && git sparse-checkout set skills
```

Catalogue complet : https://github.com/sickn33/antigravity-awesome-skills/blob/main/CATALOG.md
