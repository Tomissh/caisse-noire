-- Correction du rattachement des amendes/paiements à leur mois dans
-- situation_caisse_mois : les bornes de mois (b.debut / b.fin) sont de type
-- `date`, comparées telles quelles à `created_at` (timestamptz). Postgres
-- interprète alors ces bornes dans le fuseau horaire de la session (UTC sur
-- Supabase), pas celui de la caisse (Europe/Paris, UTC+1/+2).
--
-- Conséquence concrète : une amende saisie le 1er du mois entre minuit et
-- 1h/2h heure de Paris a un `created_at` UTC qui tombe encore la veille
-- (ex. 1er août 00h30 Paris = 31 juillet 22h30 UTC en été) → elle était
-- comptée dans le récap du mois précédent au lieu du mois de saisie réel.
--
-- Fix : convertir `created_at` en heure locale Europe/Paris avant de le
-- comparer aux bornes du mois.

create or replace function public.situation_caisse_mois(p_caisse_id uuid, p_mois date)
returns table (
  membre_id                 uuid,
  nom                       text,
  actif                     boolean,
  solde_avant_centimes      integer,
  amendes_mois_centimes     integer,
  cotisation_mois_centimes  integer,
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
  cfg as (
    select
      coalesce(cotisation_active, false) as active,
      coalesce(cotisation_montant_centimes, 0) as montant,
      coalesce(cotisation_plafonnee_par_amendes, false) as plafonnee,
      coalesce(cotisation_solde_pris_en_compte, false) as solde_pris_en_compte
    from public.caisses
    where id = p_caisse_id
  ),
  amendes_membre as (
    select
      a.membre_id,
      coalesce(sum(a.montant_centimes) filter (
        where (a.created_at at time zone 'Europe/Paris') < b.debut
      ), 0)::integer as avant,
      coalesce(sum(a.montant_centimes) filter (
        where (a.created_at at time zone 'Europe/Paris') >= b.debut
          and (a.created_at at time zone 'Europe/Paris') < b.fin
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
        where ((p.created_at at time zone 'Europe/Paris') - interval '7 days') < b.debut
      ), 0)::integer as avant,
      coalesce(sum(p.montant_centimes) filter (
        where ((p.created_at at time zone 'Europe/Paris') - interval '7 days') >= b.debut
          and ((p.created_at at time zone 'Europe/Paris') - interval '7 days') < b.fin
      ), 0)::integer as du_mois
    from public.paiements p
    cross join bornes b
    where p.caisse_id = p_caisse_id and p.supprimee_at is null
    group by p.membre_id
  )
  select
    m.id as membre_id,
    m.nom,
    m.actif,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0))::integer as solde_avant_centimes,
    coalesce(am.du_mois, 0)::integer as amendes_mois_centimes,
    cot.cotisation_du_mois::integer as cotisation_mois_centimes,
    coalesce(pm.du_mois, 0)::integer as paiements_mois_centimes,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0) - cot.cotisation_du_mois)::integer as solde_apres_centimes,
    greatest(0, -(
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0) - cot.cotisation_du_mois
    ))::integer as montant_a_payer_centimes,
    greatest(0,
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0) - cot.cotisation_du_mois
    )::integer as avance_centimes
  from public.membres m
  left join amendes_membre am on am.membre_id = m.id
  left join paiements_membre pm on pm.membre_id = m.id
  cross join cfg
  cross join lateral (
    select (
      case
        when not cfg.active or not m.actif then 0
        when not cfg.plafonnee then cfg.montant
        when not cfg.solde_pris_en_compte then
          greatest(0, cfg.montant - coalesce(am.du_mois, 0))
        else
          case
            when (
              coalesce(pm.avant, 0) - coalesce(am.avant, 0)
              + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0)
            ) < 0
              then greatest(0, cfg.montant - coalesce(am.du_mois, 0))
            else 0
          end
      end
    ) as cotisation_du_mois
  ) cot
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.situation_caisse_mois(uuid, date) to authenticated;
