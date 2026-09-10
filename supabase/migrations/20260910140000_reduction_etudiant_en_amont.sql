-- Déplace le calcul de la réduction étudiant "en amont" : partout où un
-- montant de dette/amendes est agrégé pour un membre, le montant affiché
-- pour un membre étudiant est déjà réduit de moitié (arrondi à l'euro
-- supérieur). Ainsi le paiement lui-même redevient identique entre un
-- membre étudiant et un membre normal — l'admin règle simplement le montant
-- affiché, qu'il s'agisse du solde global ou du récapitulatif mensuel.
--
-- Remplace la logique introduite dans 20260910130000 (qui n'ajustait que
-- solde_centimes, en laissant total_amendes_centimes brut) : désormais
-- total_amendes_centimes lui-même est déjà réduit pour un membre étudiant,
-- ce qui évite toute divergence entre les différents écrans qui le lisent
-- (carte Dettes, espace membre, PDF de clôture, récapitulatif mensuel).

create or replace view public.v_membre_situation
with (security_invoker = true)
as
select
  m.id                                             as membre_id,
  m.caisse_id,
  (
    case
      when m.etudiant
        then (ceil(coalesce(sum_a.total, 0) / 200.0) * 100)::integer
      else coalesce(sum_a.total, 0)::integer
    end
  )                                                 as total_amendes_centimes,
  coalesce(sum_p.total, 0)::integer                as total_paiements_centimes,
  (
    coalesce(sum_p.total, 0)
    - case
        when m.etudiant
          then (ceil(coalesce(sum_a.total, 0) / 200.0) * 100)::integer
        else coalesce(sum_a.total, 0)
      end
  )::integer                                       as solde_centimes
from public.membres m
left join lateral (
  select sum(montant_centimes)::integer as total
  from public.amendes
  where membre_id = m.id and supprimee_at is null
) sum_a on true
left join lateral (
  select sum(montant_centimes)::integer as total
  from public.paiements
  where membre_id = m.id and supprimee_at is null
) sum_p on true;

-- Récapitulatif mensuel (colonne "à payer") : même réduction, appliquée sur
-- le total des amendes DU MOIS pour un membre étudiant (pas le cumul vie
-- entière, cf. v_membre_situation ci-dessus).
create or replace function public.recap_mensuel_simple(p_caisse_id uuid, p_mois date)
returns table (
  membre_id                        uuid,
  nom                               text,
  actif                             boolean,
  amendes_mois_centimes             integer,
  paiements_mois_suivant_centimes   integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with bornes as (
    select
      date_trunc('month', p_mois)::date as debut,
      (date_trunc('month', p_mois) + interval '1 month')::date as fin,
      (date_trunc('month', p_mois) + interval '2 month')::date as fin_suivant
  ),
  amendes_mois as (
    select
      a.membre_id,
      sum(a.montant_centimes)::integer as total
    from public.amendes a
    cross join bornes b
    where a.caisse_id = p_caisse_id and a.supprimee_at is null
      and (a.created_at at time zone 'Europe/Paris') >= b.debut
      and (a.created_at at time zone 'Europe/Paris') < b.fin
    group by a.membre_id
  ),
  paiements_mois_suivant as (
    select
      p.membre_id,
      sum(p.montant_centimes)::integer as total
    from public.paiements p
    cross join bornes b
    where p.caisse_id = p_caisse_id and p.supprimee_at is null
      and (p.created_at at time zone 'Europe/Paris') >= b.fin
      and (p.created_at at time zone 'Europe/Paris') < b.fin_suivant
    group by p.membre_id
  )
  select
    m.id as membre_id,
    m.nom,
    m.actif,
    (
      case
        when m.etudiant
          then (ceil(coalesce(am.total, 0) / 200.0) * 100)::integer
        else coalesce(am.total, 0)::integer
      end
    ) as amendes_mois_centimes,
    coalesce(pm.total, 0)::integer as paiements_mois_suivant_centimes
  from public.membres m
  left join amendes_mois am on am.membre_id = m.id
  left join paiements_mois_suivant pm on pm.membre_id = m.id
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.recap_mensuel_simple(uuid, date) to authenticated;
