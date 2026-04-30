---
name: supabase-rls-postgres
description: Supabase workflow for Caisse Noire — RLS policies, migrations versionnées, génération de types TS, Edge Functions, Auth (admin) + accès membre sans compte via code caisse hashé. Trigger sur toute interaction Supabase client/server, fichiers supabase/, *.sql, migrations, RPC, ou questions sur RLS.
user-invocable: false
risk: safe
---

# Supabase — Postgres, RLS, migrations, Auth hybride

Tailored pour **Caisse Noire v2** : Supabase free tier · PostgreSQL + RLS · Auth pour admins uniquement · membres via code caisse + mdp hashé · usage privé interne · région EU (RGPD).

## When to use
- Écriture ou modif d'une migration `supabase/migrations/*.sql`
- Écriture d'une policy RLS
- Génération / mise à jour des types TS
- Logique métier SQL (fonctions, triggers)
- Edge Function
- Flux Auth admin / accès membre

## Règles d'or du projet (CDC 5.1 + 8.1)

1. **Logique métier côté DB** — jamais dans le frontend. Fonctions SQL + RPC appelées depuis Server Components / Server Actions.
2. **Migrations versionnées uniquement** — `supabase migration new`. Jamais modifier la DB via le Studio en prod.
3. **RLS activée sur toutes les tables** — sans exception.
4. **Retraits immuables** — policies REVOKE UPDATE/DELETE explicites.
5. **SMALLINT côté DB → cast explicite côté TS**.
6. **Hébergement région EU** (RGPD — CDC 8.2).

## Structure Supabase conseillée

```
supabase/
  config.toml
  migrations/
    20260415000000_init_schema.sql
    20260415000001_rls_policies.sql
    20260415000002_functions.sql
    20260415000003_triggers.sql
    20260415000004_seed_data.sql
  functions/
    hash-member-password/   # Edge Function bcrypt
      index.ts
  seed.sql
```

## CLI essentiel

```bash
# Init
supabase init

# Link au projet cloud
supabase link --project-ref <ref>

# Nouvelle migration
supabase migration new add_amendes_table

# Applique les migrations locales
supabase db push

# Pull du schéma distant (si changement hors migration)
supabase db pull

# Reset local
supabase db reset

# Génère les types TS
supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts

# Déploie une Edge Function
supabase functions deploy hash-member-password
```

**⚠️ `db push` applique les migrations locales au cloud. Toujours review le diff avant.**

## RLS — patterns pour Caisse Noire

### Helper : rôle courant
```sql
create or replace function auth.is_admin_of(caisse_uuid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.caisse_admins
    where caisse_id = caisse_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function auth.is_createur_of(caisse_uuid uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.caisses
    where id = caisse_uuid and createur_id = auth.uid()
  );
$$;
```

### Pattern : admin lecture + écriture, créateur seul sur cloture/delete
```sql
alter table public.amendes enable row level security;

create policy "admins_read"
  on public.amendes for select
  using ( auth.is_admin_of(caisse_id) );

create policy "admins_write"
  on public.amendes for insert
  with check ( auth.is_admin_of(caisse_id) );

create policy "admins_update"
  on public.amendes for update
  using ( auth.is_admin_of(caisse_id) );

-- Pas de policy DELETE sur retraits (immuables)
```

### Pattern : retraits immuables
```sql
alter table public.retraits enable row level security;

create policy "admins_insert_retraits"
  on public.retraits for insert
  with check ( auth.is_admin_of(caisse_id) );

create policy "admins_read_retraits"
  on public.retraits for select
  using ( auth.is_admin_of(caisse_id) );

-- Aucune policy UPDATE ni DELETE — REFUSÉ PAR DÉFAUT
-- Les REVOKE explicites sont redondants mais rassurants :
revoke update, delete on public.retraits from authenticated, anon;
```

### Pattern : accès membre (sans compte Supabase)
Les membres n'ont pas de `auth.uid()`. Deux options :

**Option A (recommandée) — Edge Function vérifie code + mdp, retourne un JWT court custom** :
```ts
// supabase/functions/login-membre/index.ts
import { create, getNumericDate } from "jsr:@zaubrik/djwt";

Deno.serve(async (req) => {
  const { code, password } = await req.json();
  // 1. hash bcrypt côté server
  // 2. check en DB
  // 3. émet un JWT signé avec un secret dédié (différent du JWT Supabase)
  // 4. le client stocke en sessionStorage
  // 5. les lectures "membre" passent par une API route Next qui vérifie ce JWT
  //    puis fait un select avec service_role (read-only queries scoped by caisse)
});
```
Les lectures membres passent par une **Next.js Route Handler** (pas directement au client Supabase) qui :
1. vérifie le JWT membre custom,
2. utilise le `service_role` Supabase (jamais exposé au browser) pour lire uniquement les données de cette caisse.

**⚠️ Ne JAMAIS stocker `service_role` dans `NEXT_PUBLIC_*`.**

**Option B (alternative)** : anon role + policies sur tokens stockés en DB. Plus complexe, déconseillé.

### Pattern : promotion membre → admin
```sql
create or replace function public.promote_membre_to_admin(
  p_caisse_id uuid,
  p_membre_id uuid,
  p_new_user_id uuid
) returns void language plpgsql security definer as $$
begin
  -- Seul le créateur peut promouvoir
  if not auth.is_createur_of(p_caisse_id) then
    raise exception 'Seul le créateur peut promouvoir un admin';
  end if;

  insert into public.caisse_admins (caisse_id, user_id, membre_id)
  values (p_caisse_id, p_new_user_id, p_membre_id);
end;
$$;

revoke all on function public.promote_membre_to_admin from public;
grant execute on function public.promote_membre_to_admin to authenticated;
```

**⚠️ `security definer`** exécute avec les droits du propriétaire. Toujours coupler avec un check d'autorisation explicite en début de fonction.

## Fonctions métier essentielles (CDC § 4)

```sql
-- Pénalité temps réel (CDC 4.3)
create or replace function public.get_penalite_retard(p_paiement_id uuid)
returns numeric language sql stable as $$
  select case
    when p.gel_motif is not null then 0
    when now() <= per.date_limite then 0
    else greatest(0, extract(day from now() - per.date_limite))::numeric * 2
  end
  from public.paiements p
  join public.periodes per on per.id = p.periode_id
  where p.id = p_paiement_id;
$$;

-- Cotisation mensuelle (CDC 4.2) : cron ou trigger au début de mois
-- Clôture : trigger qui passe active → cloturee + vérif paiements soldés
```

## Keep-alive (free tier pause après 7j — CDC 5.3)

Route Next.js appelée par un cron Vercel :
```ts
// app/api/ping/route.ts
import { createClient } from "@supabase/supabase-js";
export const runtime = "edge";
export async function GET() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await sb.from("caisses").select("id").limit(1);
  return Response.json({ ok: true, at: new Date().toISOString() });
}
```

`vercel.json` :
```json
{
  "crons": [{ "path": "/api/ping", "schedule": "0 6 */5 * *" }]
}
```

## Client Supabase — 3 instances

```ts
// lib/supabase/client.ts — browser (anon key)
import { createBrowserClient } from "@supabase/ssr";
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

// lib/supabase/server.ts — Server Components / Server Actions (anon + cookies)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)),
      },
    },
  );
};

// lib/supabase/admin.ts — server-only, bypass RLS (service_role)
// ⚠️ À utiliser UNIQUEMENT côté serveur et avec parcimonie
import { createClient as create } from "@supabase/supabase-js";
export const adminClient = () =>
  create(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
```

## Règles pré-merge (checklist CDC)

- [ ] Nouvelle table → RLS activée + policies SELECT/INSERT/UPDATE (pas de DELETE sauf justifié)
- [ ] Migration nommée `YYYYMMDDHHmmss_description.sql` (CLI gère)
- [ ] Types TS regénérés et commités
- [ ] Pas de secret dans le code
- [ ] Fonction métier testée en local avant push
- [ ] `supabase db lint` clean

## Variables d'env requises

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server-only, jamais NEXT_PUBLIC_
SUPABASE_JWT_SECRET=           # pour signer les JWT membres (option A)
MEMBRE_JWT_SECRET=             # alternatif, secret custom dédié
```

## Erreurs fréquentes à éviter
1. Oublier `enable row level security` → table accessible à tous les users authenticated.
2. Policy `using` sans `with check` sur UPDATE → possibilité d'insérer des lignes qu'on ne peut plus modifier.
3. `security definer` sans check d'autorisation → escalade.
4. Exposer `service_role` au browser → compromission totale.
5. Modifier le schéma via le Studio en prod → migrations désynchronisées, `db pull` va générer des diffs sales.
