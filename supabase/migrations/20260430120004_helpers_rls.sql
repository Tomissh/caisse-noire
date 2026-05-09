-- Fonctions helpers utilisées par les policies RLS
-- Caisse Noire v2 — Phase 2
--
-- Toutes en SECURITY DEFINER pour pouvoir lire les tables sans dépendre des
-- policies RLS de l'appelant (sinon récursion infinie). STABLE pour cache
-- intra-requête. Schéma fixé pour éviter les attaques par search_path.

------------------------------------------------------------------------------
-- is_super_admin() : utilisateur authentifié dans super_admins
------------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- is_createur_of(caisse_id) : auth.uid() = caisses.createur_id
------------------------------------------------------------------------------
create or replace function public.is_createur_of(p_caisse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.caisses
    where id = p_caisse_id
      and createur_id = auth.uid()
  );
$$;

------------------------------------------------------------------------------
-- is_admin_of(caisse_id) : créateur OU listé dans admins_caisse
------------------------------------------------------------------------------
create or replace function public.is_admin_of(p_caisse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_createur_of(p_caisse_id)
    or exists (
      select 1
      from public.admins_caisse
      where caisse_id = p_caisse_id
        and user_id   = auth.uid()
    );
$$;

------------------------------------------------------------------------------
-- is_membre_of(caisse_id) : authentifié via JWT custom Edge Function
--
-- Le JWT custom signé par login-membre porte les claims :
--   { role: 'membre', caisse_id: <uuid>, membre_id: <uuid> }
-- (Le claim 'role' standard reste 'authenticated' pour passer GoTrue ; on
--  utilise un claim custom 'app_role' pour distinguer un membre.)
------------------------------------------------------------------------------
create or replace function public.is_membre_of(p_caisse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.jwt() ->> 'app_role', '') = 'membre'
    and (auth.jwt() ->> 'caisse_id')::uuid = p_caisse_id;
$$;

------------------------------------------------------------------------------
-- current_membre_id() : id du membre porté par le JWT, ou null
------------------------------------------------------------------------------
create or replace function public.current_membre_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(auth.jwt() ->> 'app_role', '') = 'membre'
      then nullif(auth.jwt() ->> 'membre_id', '')::uuid
    else null
  end;
$$;

------------------------------------------------------------------------------
-- caisse_est_ouverte(caisse_id) : helper pour bloquer les écritures sur
-- caisse clôturée (sauf super_admin qui peut tout)
------------------------------------------------------------------------------
create or replace function public.caisse_est_ouverte(p_caisse_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.caisses
    where id = p_caisse_id
      and cloturee_at is null
  );
$$;

-- Permissions d'exécution
grant execute on function public.is_super_admin()         to anon, authenticated;
grant execute on function public.is_createur_of(uuid)     to anon, authenticated;
grant execute on function public.is_admin_of(uuid)        to anon, authenticated;
grant execute on function public.is_membre_of(uuid)       to anon, authenticated;
grant execute on function public.current_membre_id()      to anon, authenticated;
grant execute on function public.caisse_est_ouverte(uuid) to anon, authenticated;
