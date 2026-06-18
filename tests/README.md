# Tests

## Unit (Vitest)

```bash
npm test            # run unique
npm run test:watch  # mode watch
```

## E2E (Playwright + Supabase local)

Prérequis :
1. **Docker Desktop** lancé (Supabase local exécute Postgres, GoTrue, Storage, Realtime en containers)
2. **Playwright browsers** : `npx playwright install chromium` (~150 Mo, une fois)

### Premier setup local

```bash
# Démarre la stack Supabase locale (≈ 30 s première fois, télécharge les images)
npx supabase start

# Récupère les clés générées et les exporte dans .env.test.local
npx supabase status --output env > .env.test.local

# Reset DB + applique migrations + lance le seed TS
npm run test:e2e:reset
```

### Run les tests

```bash
# Charge .env.test.local puis lance Playwright
npm run test:e2e
```

Playwright lance lui-même `npm run dev` via la config `webServer`. Les variables `NEXT_PUBLIC_SUPABASE_URL` et clés sont passées au dev server pour pointer sur le Supabase local au lieu de la prod.

### Arrêter

```bash
npx supabase stop
```

## Comptes seed

Fixés dans `tests/setup/env.ts` :

| Rôle | Email | Password |
|---|---|---|
| Admin créateur | `e2e-admin@test.local` | `TestAdmin1234!` |
| Super-admin | `e2e-super@test.local` | `TestSuper1234!` |
| Membre 1 | (code `E2ETEST1`) Alice Dupont | `alice1234` |
| Membre 2 | (code `E2ETEST1`) Bob Martin | `bob1234` |
