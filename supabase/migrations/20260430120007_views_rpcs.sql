-- Vues et fonctions RPC métier
-- Caisse Noire v2 — Phase 2

------------------------------------------------------------------------------
-- Vue : situation par membre (cumul vie entière)
--   solde_centimes : positif = avance, négatif = dette
------------------------------------------------------------------------------
create or replace view public.v_membre_situation
with (security_invoker = true)
as
select
  m.id                                            as membre_id,
  m.caisse_id,
  coalesce(sum(a.montant_centimes), 0)::integer   as total_amendes_centimes,
  coalesce(sum(p.montant_centimes), 0)::integer   as total_paiements_centimes,
  (coalesce(sum(p.montant_centimes), 0)
   - coalesce(sum(a.montant_centimes), 0))::integer as solde_centimes
from public.membres m
left join public.amendes a
       on a.membre_id = m.id and a.supprimee_at is null
left join public.paiements p
       on p.membre_id = m.id and p.supprimee_at is null
group by m.id, m.caisse_id;

------------------------------------------------------------------------------
-- Vue : solde de caisse (argent physique)
--   = paiements actifs − retraits
------------------------------------------------------------------------------
create or replace view public.v_caisse_solde
with (security_invoker = true)
as
select
  c.id                                            as caisse_id,
  coalesce(sum_p.total, 0)::integer               as total_paiements_centimes,
  coalesce(sum_r.total, 0)::integer               as total_retraits_centimes,
  (coalesce(sum_p.total, 0) - coalesce(sum_r.total, 0))::integer as solde_centimes
from public.caisses c
left join lateral (
  select sum(montant_centimes)::integer as total
  from public.paiements
  where caisse_id = c.id and supprimee_at is null
) sum_p on true
left join lateral (
  select sum(montant_centimes)::integer as total
  from public.retraits
  where caisse_id = c.id
) sum_r on true;

------------------------------------------------------------------------------
-- Fonction : situation mensuelle d'un membre (vue UI)
--   Renvoie une ligne par mois où il y a eu une amende OU un paiement,
--   avec totaux du mois et solde cumulé en fin de mois.
------------------------------------------------------------------------------
create or replace function public.situation_membre_par_mois(p_membre_id uuid)
returns table (
  mois                            date,
  amendes_centimes                integer,
  paiements_centimes              integer,
  solde_mois_centimes             integer,
  solde_cumul_centimes            integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with mouvements as (
    select
      date_trunc('month', a.created_at)::date as mois,
      a.montant_centimes                       as amende,
      0                                        as paiement
    from public.amendes a
    where a.membre_id = p_membre_id and a.supprimee_at is null
    union all
    select
      date_trunc('month', p.created_at)::date as mois,
      0                                        as amende,
      p.montant_centimes                       as paiement
    from public.paiements p
    where p.membre_id = p_membre_id and p.supprimee_at is null
  ),
  agreges as (
    select
      mois,
      sum(amende)::integer    as amendes_centimes,
      sum(paiement)::integer  as paiements_centimes,
      (sum(paiement) - sum(amende))::integer as solde_mois_centimes
    from mouvements
    group by mois
  )
  select
    mois,
    amendes_centimes,
    paiements_centimes,
    solde_mois_centimes,
    sum(solde_mois_centimes) over (order by mois)::integer as solde_cumul_centimes
  from agreges
  order by mois;
$$;

grant execute on function public.situation_membre_par_mois(uuid)
  to anon, authenticated;

------------------------------------------------------------------------------
-- RPC : supprimer une amende (soft-delete avec motif obligatoire)
------------------------------------------------------------------------------
create or replace function public.supprimer_amende(
  p_amende_id uuid,
  p_motif     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_id uuid;
begin
  if p_motif is null or length(trim(p_motif)) < 5 then
    raise exception 'Le motif de suppression doit faire au moins 5 caractères'
      using errcode = '22023';
  end if;

  select caisse_id into v_caisse_id
  from public.amendes
  where id = p_amende_id and supprimee_at is null;

  if v_caisse_id is null then
    raise exception 'Amende introuvable ou déjà supprimée'
      using errcode = 'P0002';
  end if;

  if not (public.is_super_admin()
          or (public.is_admin_of(v_caisse_id)
              and public.caisse_est_ouverte(v_caisse_id))) then
    raise exception 'Non autorisé à supprimer cette amende'
      using errcode = '42501';
  end if;

  update public.amendes
     set supprimee_at = now(),
         supprimee_par_user_id = auth.uid(),
         motif_suppression = trim(p_motif)
   where id = p_amende_id;
end;
$$;

grant execute on function public.supprimer_amende(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- RPC : supprimer un paiement
------------------------------------------------------------------------------
create or replace function public.supprimer_paiement(
  p_paiement_id uuid,
  p_motif       text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_id uuid;
begin
  if p_motif is null or length(trim(p_motif)) < 5 then
    raise exception 'Le motif de suppression doit faire au moins 5 caractères'
      using errcode = '22023';
  end if;

  select caisse_id into v_caisse_id
  from public.paiements
  where id = p_paiement_id and supprimee_at is null;

  if v_caisse_id is null then
    raise exception 'Paiement introuvable ou déjà supprimé'
      using errcode = 'P0002';
  end if;

  if not (public.is_super_admin()
          or (public.is_admin_of(v_caisse_id)
              and public.caisse_est_ouverte(v_caisse_id))) then
    raise exception 'Non autorisé à supprimer ce paiement'
      using errcode = '42501';
  end if;

  update public.paiements
     set supprimee_at = now(),
         supprimee_par_user_id = auth.uid(),
         motif_suppression = trim(p_motif)
   where id = p_paiement_id;
end;
$$;

grant execute on function public.supprimer_paiement(uuid, text) to authenticated;

------------------------------------------------------------------------------
-- RPC : clôturer une caisse (créateur uniquement, ou super_admin)
------------------------------------------------------------------------------
create or replace function public.cloturer_caisse(p_caisse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_super_admin() or public.is_createur_of(p_caisse_id)) then
    raise exception 'Seul le créateur peut clôturer cette caisse'
      using errcode = '42501';
  end if;

  update public.caisses
     set cloturee_at = now()
   where id = p_caisse_id
     and cloturee_at is null;
end;
$$;

grant execute on function public.cloturer_caisse(uuid) to authenticated;

------------------------------------------------------------------------------
-- RPC : réouvrir une caisse (super_admin uniquement)
------------------------------------------------------------------------------
create or replace function public.reouvrir_caisse(p_caisse_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Seul un super-admin peut réouvrir une caisse'
      using errcode = '42501';
  end if;

  update public.caisses
     set cloturee_at = null
   where id = p_caisse_id
     and cloturee_at is not null;
end;
$$;

grant execute on function public.reouvrir_caisse(uuid) to authenticated;
