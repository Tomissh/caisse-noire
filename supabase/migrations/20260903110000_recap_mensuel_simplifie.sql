-- Simplification du Récapitulatif mensuel (vue admin caisse) : remplace le
-- calcul de solde cumulé (solde reporté / cotisation / avance / à payer par
-- différence) par une lecture brute à deux colonnes :
--   - amendes_mois_centimes            : amendes prises durant le mois M
--     (cotisation comprise, désormais matérialisée en vraie ligne amendes
--     depuis 20260903100000_cotisation_materialisee.sql).
--   - paiements_mois_suivant_centimes  : paiements enregistrés durant le
--     mois M+1 — chaque membre paie ses amendes du mois en début du mois
--     suivant, donc le "payé" pertinent pour la ligne du mois M est celui
--     du mois M+1, pas celui du mois M lui-même.
-- Remplace situation_caisse_mois, devenue obsolète (plus aucun autre écran
-- ne l'utilisait — vérifié : seule src/app/(admin)/admin/caisses/[caisseId]/
-- page.tsx l'appelait, pour le Récapitulatif mensuel).

drop function if exists public.situation_caisse_mois(uuid, date);

create function public.recap_mensuel_simple(p_caisse_id uuid, p_mois date)
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
    coalesce(am.total, 0)::integer as amendes_mois_centimes,
    coalesce(pm.total, 0)::integer as paiements_mois_suivant_centimes
  from public.membres m
  left join amendes_mois am on am.membre_id = m.id
  left join paiements_mois_suivant pm on pm.membre_id = m.id
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.recap_mensuel_simple(uuid, date) to authenticated;
