-- Connexion admin par nom d'utilisateur (en plus de l'email).
--
-- admin_profiles : associe un identifiant (username) au compte Supabase
-- Auth créé via l'espace super-admin (seul point de création de comptes
-- admin dans l'app). Les comptes créés avant cette migration (ex. le tout
-- premier créateur, provisionné manuellement) n'ont pas de ligne ici et
-- continuent de se connecter par email — resolve_username_email est un
-- complément, pas un remplacement.

create table public.admin_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now(),
  constraint admin_profiles_username_format
    check (username ~ '^[a-z0-9._-]{3,32}$')
);

alter table public.admin_profiles enable row level security;

create policy admin_profiles_select_self
  on public.admin_profiles for select
  to authenticated
  using (user_id = auth.uid());

------------------------------------------------------------------------------
-- Fonction : résout un nom d'utilisateur en email pour la page de connexion.
--   Appelée par un visiteur anonyme (avant authentification) — security
--   definer pour pouvoir lire auth.users, qui n'est pas exposé via l'API.
--   Renvoie null si le username est inconnu (le front affiche un message
--   générique "Identifiants invalides", jamais "username introuvable", pour
--   ne pas faciliter l'énumération des comptes).
------------------------------------------------------------------------------
create or replace function public.resolve_username_email(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select u.email into v_email
  from public.admin_profiles p
  join auth.users u on u.id = p.user_id
  where p.username = lower(trim(p_username));
  return v_email;
end;
$$;

grant execute on function public.resolve_username_email(text) to anon, authenticated;
