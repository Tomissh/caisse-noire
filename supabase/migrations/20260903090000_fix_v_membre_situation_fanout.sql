-- Fix : v_membre_situation gonflait les totaux par produit cartésien
--
-- Les deux LEFT JOIN (amendes, paiements) étaient branchés indépendamment
-- sur m.id sans être agrégés au préalable : pour un membre avec N amendes
-- actives et M paiements actifs, le join produisait N×M lignes, donc
-- total_amendes_centimes était multiplié par le nombre de paiements et
-- total_paiements_centimes par le nombre d'amendes. Repris ici sur le même
-- pattern que v_caisse_solde (sous-requêtes LATERAL déjà agrégées à une
-- seule ligne avant jointure).
create or replace view public.v_membre_situation
with (security_invoker = true)
as
select
  m.id                                             as membre_id,
  m.caisse_id,
  coalesce(sum_a.total, 0)::integer                as total_amendes_centimes,
  coalesce(sum_p.total, 0)::integer                as total_paiements_centimes,
  (coalesce(sum_p.total, 0) - coalesce(sum_a.total, 0))::integer as solde_centimes
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
