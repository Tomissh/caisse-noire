-- Récapitulatif mensuel par membre (admin) — permet de sortir, pour un mois
-- donné, ce que chaque membre doit encore payer en tenant compte de son
-- solde reporté (avance ou retard des mois précédents).

------------------------------------------------------------------------------
-- Fonction : situation d'un mois pour tous les membres d'une caisse
--   p_mois : n'importe quelle date du mois ciblé (tronquée au 1er du mois)
--   solde_avant_centimes     : cumul (paiements − amendes) avant le mois
--   amendes_mois_centimes    : amendes prises durant le mois
--   paiements_mois_centimes  : paiements enregistrés durant le mois
--   solde_apres_centimes     : solde cumulé à l'issue du mois
--   montant_a_payer_centimes : reste à payer (0 si à jour ou en avance)
--   avance_centimes          : avance restante (0 si en dette)
------------------------------------------------------------------------------
create or replace function public.situation_caisse_mois(p_caisse_id uuid, p_mois date)
returns table (
  membre_id                 uuid,
  prenom                    text,
  nom                       text,
  actif                     boolean,
  solde_avant_centimes      integer,
  amendes_mois_centimes     integer,
  paiements_mois_centimes   integer,
  solde_apres_centimes      integer,
  montant_a_payer_centimes  integer,
  avance_centimes           integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with bornes as (
    select
      date_trunc('month', p_mois)::date as debut,
      (date_trunc('month', p_mois) + interval '1 month')::date as fin
  ),
  amendes_membre as (
    select
      a.membre_id,
      coalesce(sum(a.montant_centimes) filter (where a.created_at < b.debut), 0)::integer as avant,
      coalesce(sum(a.montant_centimes) filter (
        where a.created_at >= b.debut and a.created_at < b.fin
      ), 0)::integer as du_mois
    from public.amendes a
    cross join bornes b
    where a.caisse_id = p_caisse_id and a.supprimee_at is null
    group by a.membre_id
  ),
  paiements_membre as (
    select
      p.membre_id,
      coalesce(sum(p.montant_centimes) filter (where p.created_at < b.debut), 0)::integer as avant,
      coalesce(sum(p.montant_centimes) filter (
        where p.created_at >= b.debut and p.created_at < b.fin
      ), 0)::integer as du_mois
    from public.paiements p
    cross join bornes b
    where p.caisse_id = p_caisse_id and p.supprimee_at is null
    group by p.membre_id
  )
  select
    m.id as membre_id,
    m.prenom,
    m.nom,
    m.actif,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0))::integer as solde_avant_centimes,
    coalesce(am.du_mois, 0)::integer as amendes_mois_centimes,
    coalesce(pm.du_mois, 0)::integer as paiements_mois_centimes,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0))::integer as solde_apres_centimes,
    greatest(0, -(
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0)
    ))::integer as montant_a_payer_centimes,
    greatest(0,
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0)
    )::integer as avance_centimes
  from public.membres m
  left join amendes_membre am on am.membre_id = m.id
  left join paiements_membre pm on pm.membre_id = m.id
  where m.caisse_id = p_caisse_id
  order by m.prenom, m.nom;
$$;

grant execute on function public.situation_caisse_mois(uuid, date) to authenticated;
