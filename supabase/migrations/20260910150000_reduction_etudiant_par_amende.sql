-- Correction : la réduction étudiant ne s'applique pas à TOUTES les amendes
-- d'un membre étudiant, seulement à celles marquées "-50% étudiant" au
-- moment de la déclaration. Remplace l'approche de 20260910140000 (qui
-- réduisait tout le total des amendes d'un membre étudiant), jugée trop
-- large : certaines amendes (ex. cotisation) restent pleines même pour un
-- étudiant, seules certaines amendes spécifiques sont éligibles.
--
-- Le flag est porté par la déclaration d'amende elle-même (comme
-- jour_match, cf. 20260806110000), pas par le motif du catalogue : un même
-- motif peut être éligible ou non selon les circonstances.
--
-- Effet : montant_centimes stocké reste le montant plein déclaré (pas de
-- trigger de mutation, contrairement à jour_match) — la réduction est
-- purement un calcul d'agrégation dans v_membre_situation et
-- recap_mensuel_simple, et seulement si le membre est étudiant (une amende
-- marquée -50% pour un membre non étudiant compte plein).

alter table public.amendes
  add column reduction_etudiant boolean not null default false;

comment on column public.amendes.reduction_etudiant is
  '-50% étudiant : cette amende compte pour moitié (arrondi à l''euro supérieur sur le total réduit du membre) dans v_membre_situation et recap_mensuel_simple, mais uniquement si le membre est étudiant (membres.etudiant). N''affecte pas montant_centimes, qui reste le montant plein déclaré.';

create or replace view public.v_membre_situation
with (security_invoker = true)
as
select
  base.membre_id,
  base.caisse_id,
  base.total_amendes_centimes,
  base.total_paiements_centimes,
  (base.total_paiements_centimes - base.total_amendes_centimes)::integer as solde_centimes
from (
  select
    m.id as membre_id,
    m.caisse_id,
    (
      coalesce(sum_a_plein.total, 0)
      + case
          when m.etudiant
            then (ceil(coalesce(sum_a_reduit.total, 0) / 200.0) * 100)::integer
          else coalesce(sum_a_reduit.total, 0)
        end
    )::integer as total_amendes_centimes,
    coalesce(sum_p.total, 0)::integer as total_paiements_centimes
  from public.membres m
  left join lateral (
    select sum(montant_centimes)::integer as total
    from public.amendes
    where membre_id = m.id and supprimee_at is null and reduction_etudiant = false
  ) sum_a_plein on true
  left join lateral (
    select sum(montant_centimes)::integer as total
    from public.amendes
    where membre_id = m.id and supprimee_at is null and reduction_etudiant = true
  ) sum_a_reduit on true
  left join lateral (
    select sum(montant_centimes)::integer as total
    from public.paiements
    where membre_id = m.id and supprimee_at is null
  ) sum_p on true
) base;

-- Récapitulatif mensuel (colonne "à payer") : même logique, scindée par
-- mois plutôt que sur le cumul vie entière.
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
      sum(a.montant_centimes) filter (where not a.reduction_etudiant)::integer as total_plein,
      sum(a.montant_centimes) filter (where a.reduction_etudiant)::integer     as total_reduit
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
      coalesce(am.total_plein, 0)
      + case
          when m.etudiant
            then (ceil(coalesce(am.total_reduit, 0) / 200.0) * 100)::integer
          else coalesce(am.total_reduit, 0)
        end
    )::integer as amendes_mois_centimes,
    coalesce(pm.total, 0)::integer as paiements_mois_suivant_centimes
  from public.membres m
  left join amendes_mois am on am.membre_id = m.id
  left join paiements_mois_suivant pm on pm.membre_id = m.id
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.recap_mensuel_simple(uuid, date) to authenticated;
