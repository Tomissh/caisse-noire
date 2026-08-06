-- Cotisation mensuelle obligatoire, paramétrable par caisse (pas un motif
-- d'amende — c'est un montant automatique, pas un évènement à déclarer).
--
-- Paramètres (table caisses) :
--   - cotisation_active                : la caisse applique une cotisation
--     mensuelle ou non.
--   - cotisation_montant_centimes      : montant de la cotisation.
--   - cotisation_plafonnee_par_amendes : condition 1 — si activée, la
--     cotisation n'est plus additive : elle devient un plancher. Un membre
--     paie max(amendes_du_mois, cotisation) au lieu de amendes+cotisation.
--     Si désactivée, la cotisation s'ajoute systématiquement aux amendes du
--     mois, chaque mois, pour tout membre actif.
--   - cotisation_solde_pris_en_compte  : condition 2 (n'a de sens que si la
--     condition 1 est active) — si activée, le plancher n'est appliqué que
--     si le membre termine le mois en négatif une fois son solde reporté et
--     ses amendes du mois pris en compte (mais pas encore la cotisation).
--     S'il reste à l'avance/à l'équilibre, la cotisation n'est pas due.
--
-- La cotisation n'est due que par les membres actifs, et n'est jamais
-- matérialisée en ligne `amendes` — uniquement calculée par
-- situation_caisse_mois (récapitulatif mensuel), qui reste la seule vue
-- affectée. Le solde "vie entière" (v_membre_situation, Dettes, podium)
-- continue de ne refléter que les écritures réellement enregistrées.

alter table public.caisses
  add column cotisation_active boolean not null default false,
  add column cotisation_montant_centimes integer not null default 0,
  add column cotisation_plafonnee_par_amendes boolean not null default false,
  add column cotisation_solde_pris_en_compte boolean not null default false;

alter table public.caisses
  add constraint caisses_cotisation_montant_check
    check (cotisation_montant_centimes >= 0 and cotisation_montant_centimes % 100 = 0);

comment on column public.caisses.cotisation_active is
  'Cotisation mensuelle obligatoire activée pour cette caisse.';
comment on column public.caisses.cotisation_montant_centimes is
  'Montant de la cotisation mensuelle, en centimes.';
comment on column public.caisses.cotisation_plafonnee_par_amendes is
  'Si vrai : la cotisation devient un plancher (max avec les amendes du mois) au lieu de s''ajouter systématiquement.';
comment on column public.caisses.cotisation_solde_pris_en_compte is
  'Si vrai (et plafonnée activée) : le plancher n''est appliqué que si le solde reporté + amendes du mois est négatif.';

-- situation_caisse_mois : ajout de la colonne cotisation_mois_centimes,
-- prise en compte dans solde_apres/montant_a_payer/avance. Le type de
-- retour change -> drop puis recreate (CREATE OR REPLACE ne le permet pas).
drop function if exists public.situation_caisse_mois(uuid, date);

create function public.situation_caisse_mois(p_caisse_id uuid, p_mois date)
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
