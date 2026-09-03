-- Packs : compteur simple par membre, sans montant ni cotisation — juste un
-- "pack" ajouté ou retiré (ex. tournée à rendre). Ledger immuable (delta
-- +1/-1), même philosophie que retraits : correction = mouvement inverse,
-- pas d'édition/suppression a posteriori. Historique conservé pour la
-- traçabilité (qui/quand), comme le reste des écritures de la caisse.

create table public.packs_mouvements (
  id                     uuid primary key default gen_random_uuid(),
  caisse_id              uuid not null references public.caisses(id) on delete cascade,
  membre_id              uuid not null references public.membres(id) on delete restrict,
  delta                  integer not null check (delta in (1, -1)),
  enregistre_par_user_id uuid not null references auth.users(id) on delete restrict,
  created_at             timestamptz not null default now()
);

comment on table public.packs_mouvements is
  'Ledger immuable des ajouts/retraits de "packs" par membre. Pas de montant, '
  'pas de lien avec amendes/paiements/cotisation. delta = +1 (ajout) ou -1 '
  '(retrait). Correction = mouvement inverse, comme retraits.';

create index packs_mouvements_caisse_id_idx on public.packs_mouvements (caisse_id);
create index packs_mouvements_membre_id_idx on public.packs_mouvements (membre_id);
create index packs_mouvements_caisse_created_idx
  on public.packs_mouvements (caisse_id, created_at desc);

------------------------------------------------------------------------------
-- Vue : total de packs par membre. Sous-requête LATERAL déjà agrégée à une
-- seule ligne avant jointure — jamais de LEFT JOIN à plat + GROUP BY entre
-- tables 1-N (cf. le bug de fanout corrigé sur v_membre_situation,
-- migration 20260903090000_fix_v_membre_situation_fanout.sql).
------------------------------------------------------------------------------
create view public.v_membre_packs
with (security_invoker = true)
as
select
  m.id as membre_id,
  m.caisse_id,
  coalesce(sum_pk.total, 0)::integer as packs_count
from public.membres m
left join lateral (
  select sum(delta)::integer as total
  from public.packs_mouvements
  where membre_id = m.id
) sum_pk on true;

------------------------------------------------------------------------------
-- RLS : mêmes règles que retraits (select admin/créateur/super_admin +
-- membre de la caisse, insert admin/créateur+super_admin avec caisse
-- ouverte, pas d'update ni delete — immuable).
------------------------------------------------------------------------------
alter table public.packs_mouvements enable row level security;

create policy packs_mouvements_select
  on public.packs_mouvements for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or public.is_membre_of(caisse_id)
  );

create policy packs_mouvements_insert
  on public.packs_mouvements for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_admin_of(caisse_id)
      and public.caisse_est_ouverte(caisse_id)
      and enregistre_par_user_id = auth.uid()
    )
  );

------------------------------------------------------------------------------
-- Trigger : le membre doit appartenir à la caisse (même garde qu'amendes/
-- paiements/retraits).
------------------------------------------------------------------------------
create function public.tg_packs_check_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_membre uuid;
begin
  select caisse_id into v_caisse_membre from public.membres where id = new.membre_id;
  if v_caisse_membre is null or v_caisse_membre <> new.caisse_id then
    raise exception 'Le membre % n''appartient pas à la caisse %', new.membre_id, new.caisse_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger packs_mouvements_check_caisse
  before insert on public.packs_mouvements
  for each row execute function public.tg_packs_check_caisse();

revoke execute on function public.tg_packs_check_caisse() from public;

------------------------------------------------------------------------------
-- Immuabilité : pas d'UPDATE, pas de DELETE, jamais.
------------------------------------------------------------------------------
create function public.tg_packs_immutables()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Les mouvements de packs sont immuables. Pour corriger, ajouter un mouvement inverse.'
    using errcode = '42501';
end;
$$;

create trigger packs_mouvements_no_update
  before update on public.packs_mouvements
  for each row execute function public.tg_packs_immutables();

create trigger packs_mouvements_no_delete
  before delete on public.packs_mouvements
  for each row execute function public.tg_packs_immutables();

revoke execute on function public.tg_packs_immutables() from public;

------------------------------------------------------------------------------
-- Audit log.
------------------------------------------------------------------------------
create function public.tg_log_pack()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tg_audit('pack.create', 'packs_mouvements', new.id, new.caisse_id,
    jsonb_build_object('membre_id', new.membre_id, 'delta', new.delta));
  return new;
end;
$$;

create trigger packs_mouvements_audit
  after insert on public.packs_mouvements
  for each row execute function public.tg_log_pack();

revoke execute on function public.tg_log_pack() from public;
