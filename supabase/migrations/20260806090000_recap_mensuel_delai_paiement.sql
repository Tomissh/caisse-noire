-- Récap mensuel : rattache un paiement au mois des amendes qu'il solde, pas
-- au mois où il a été enregistré.
--
-- Usage réel de la caisse : les amendes d'un mois sont payées la première
-- semaine du mois suivant. Sans ce correctif, un paiement fait le 3 août
-- pour des amendes de juillet apparaissait dans le récap d'août au lieu de
-- juillet, et gonflait à tort son "payé ce mois" pendant que juillet
-- restait affiché comme non soldé.
--
-- On décale donc la date des paiements de 7 jours en arrière avant de les
-- rattacher à un mois (les amendes, elles, restent rattachées à leur mois
-- réel). Un paiement du 1er au 7 du mois M retombe ainsi dans le mois M-1 ;
-- un paiement à partir du 8 reste dans le mois M.

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
      coalesce(sum(p.montant_centimes) filter (
        where (p.created_at - interval '7 days') < b.debut
      ), 0)::integer as avant,
      coalesce(sum(p.montant_centimes) filter (
        where (p.created_at - interval '7 days') >= b.debut
          and (p.created_at - interval '7 days') < b.fin
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
