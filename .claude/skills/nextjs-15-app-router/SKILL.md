---
name: nextjs-15-app-router
description: Build features in Next.js 15 App Router with TypeScript strict, Server Components by default, Server Actions, route handlers, and Vercel Hobby constraints in mind. Triggers on any file under app/, route.ts, page.tsx, layout.tsx, server action, or when asked about Next.js 15 patterns.
user-invocable: false
risk: safe
---

# Next.js 15 — App Router, TS strict, Vercel Hobby

Tailored for **Caisse Noire v2** : Next.js 15 · App Router · TypeScript strict · Tailwind + shadcn/ui · Supabase · Vercel Hobby · mobile-first · dark mode · français.

## When to use
- Any code in `app/` (layouts, pages, route handlers, server actions)
- Choosing between Server vs Client Components
- Data fetching, mutations, caching, revalidation
- Middleware for auth guards (admin vs membre)
- Métadonnées / head management (privée interne, pas SEO)

## Core rules (non négociables)

### Server Components by default
- `"use client"` **seulement** quand tu as besoin de state/effects/event handlers/browser APIs.
- Pousse `"use client"` le plus bas possible dans l'arbre (feuilles, pas layouts).
- Les Server Components peuvent importer des Client Components — l'inverse n'est **pas** vrai (sauf via composition `children`).

### Data fetching — règle d'or Caisse Noire
> **Jamais de logique métier dans le frontend — tout dans Supabase.** (CDC 8.1)

- Fetch dans des Server Components ou Server Actions, **jamais** dans un `useEffect`.
- Appels Supabase côté serveur via le client server-side (`createServerClient`), pas le client browser.
- Les RLS Postgres sont la source unique de vérité pour les autorisations. Ne jamais vérifier les rôles uniquement côté React.

### Server Actions (mutations)
Préférer les Server Actions aux Route Handlers pour les mutations déclenchées depuis un formulaire :

```ts
// app/admin/amendes/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

export async function attribuerAmende(formData: FormData) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("attribuer_amende", {
    membre_id: formData.get("membre_id"),
    amende_id: formData.get("amende_id"),
    jour_match: formData.get("jour_match") === "on",
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/amendes");
}
```

Dans le form :
```tsx
<form action={attribuerAmende}>…</form>
```

### Route Handlers — quand les utiliser
- **PDF streaming** (route Node runtime pour `@react-pdf/renderer` ou `pdf-lib`).
- **Webhooks / cron** (keep-alive Supabase).
- API consommée par un client non-formulaire.

Exemple route handler PDF :
```ts
// app/api/cloture/[id]/pdf/route.ts
export const runtime = "nodejs"; // requis si pas Edge-compatible
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 15: params is a Promise
  // ...
  return new Response(pdfBuffer, {
    headers: { "Content-Type": "application/pdf" },
  });
}
```

**⚠️ Next.js 15 breaking change** : `params` et `searchParams` sont désormais des Promises — `await` obligatoire.

### Caching & revalidation
- Fetches Supabase sont par défaut **dynamiques** (cookies → pas de cache statique).
- Utiliser `revalidatePath` / `revalidateTag` après chaque mutation.
- Pour la landing ou pages statiques : `export const revalidate = 3600;`.

### Middleware (auth guard)
```ts
// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ping).*)"],
};
```

Pour les routes membre (sans compte Supabase) : garder la session en `sessionStorage` côté client et vérifier le code caisse dans une Server Action au login.

### Cookies & `headers()` / `cookies()`
Next.js 15 : async obligatoire.
```ts
import { cookies, headers } from "next/headers";

const cookieStore = await cookies();
const h = await headers();
```

### TypeScript strict
- `"strict": true` + `"noUncheckedIndexedAccess": true` dans `tsconfig.json`.
- **Pas de `any`** (règle CDC 8.1). Préférer `unknown` + type guards.
- Types Supabase générés : `supabase gen types typescript --project-id <id> > lib/supabase/database.types.ts`.
- Cast explicite des `SMALLINT` Postgres côté client (CDC 8.1 — déjà identifié).

### Structure fichiers (rappel)
```
app/
  (public)/            # routes sans auth
    login/
  (admin)/             # protégées par middleware
    layout.tsx
    dashboard/
    amendes/
    membres/
    periodes/
    retraits/
    cloture/
  (membre)/            # read-only membre
    layout.tsx
    mes-amendes/
  api/
    ping/route.ts      # keep-alive Supabase
    cloture/[id]/pdf/route.ts
lib/
  supabase/
    client.ts          # browser
    server.ts          # server components
    middleware.ts      # middleware helper
    database.types.ts  # généré
components/
  ui/                  # shadcn/ui
  features/            # par domaine
```

### Vercel Hobby — limites à respecter
- **Fonctions lambda** : 50 Mo zippée (Puppeteer passe pas — voir skill `pdf-server-vercel`).
- **Timeout** : 10s max par défaut pour les routes, 60s pour App Router (`maxDuration`).
- **Cron** : 2 crons max sur Hobby (suffit pour le keep-alive).
- **Bandwidth** : 100 Go/mois — non-bloquant pour usage interne.

### next.config pour le projet
```ts
// next.config.ts
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // activer seulement ce dont on a besoin
  },
};

export default config;
```

### Erreurs fréquentes à éviter
1. Fetch client-side pour des données sensibles → fuite possible si RLS mal configurées.
2. Mutations sans `revalidatePath` → UI stale.
3. Oublier `await` sur `params` / `cookies()` / `headers()` en Next 15.
4. Mettre des secrets dans des composants client (`NEXT_PUBLIC_*` = public).
5. Utiliser `useEffect` pour du data-fetching initial (anti-pattern RSC).

## Références
- Docs App Router : https://nextjs.org/docs/app
- Breaking changes Next 15 : https://nextjs.org/docs/app/building-your-application/upgrading/version-15
