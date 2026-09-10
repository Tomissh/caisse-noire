-- Applique la réduction "étudiant" (moitié, arrondie à l'euro supérieur) au
-- solde réel d'un membre, pas seulement à l'affichage du formulaire de
-- paiement (cf. 20260910120000_membres_etudiant.sql).
--
-- Sans ce correctif, un membre étudiant devant 35 € qui règle 35 € (montant
-- plein, pas le montant réduit) voyait solde_centimes = 0, alors qu'il ne
-- devait réellement que 18 € (ceil(35/2)) et est donc en avance de 17 €.
--
-- total_amendes_centimes reste le montant brut déclaré (transparence/audit,
-- ex. affichage "Total amendes" côté membre). Seul solde_centimes change de
-- formule pour un membre étudiant : il soustrait le montant réellement dû
-- (moitié arrondie à l'euro supérieur) plutôt que le montant brut.
--
-- Le récapitulatif mensuel (recap_mensuel_simple, colonnes "à payer/payé")
-- n'est volontairement PAS touché ici : il reste sur les montants bruts,
-- comme décidé lors de l'ajout du statut étudiant.

create or replace view public.v_membre_situation
with (security_invoker = true)
as
select
  m.id                                             as membre_id,
  m.caisse_id,
  coalesce(sum_a.total, 0)::integer                as total_amendes_centimes,
  coalesce(sum_p.total, 0)::integer                as total_paiements_centimes,
  (
    coalesce(sum_p.total, 0)
    - case
        when m.etudiant
          then (ceil(coalesce(sum_a.total, 0) / 200.0) * 100)::integer
        else coalesce(sum_a.total, 0)
      end
  )::integer as solde_centimes
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
