-- Matérialisation de la cotisation mensuelle en vraies lignes `amendes`.
--
-- Jusqu'ici, la cotisation (supabase/migrations/20260806140000_cotisation_mensuelle.sql)
-- n'existait QUE virtuellement dans situation_caisse_mois (Récapitulatif
-- mensuel / Classement à réclamer). v_membre_situation — qui alimente la
-- carte Dettes, le popup profil membre, le dashboard membre, le podium et
-- l'export PDF — ne connaît que les vraies lignes amendes/paiements et
-- ignorait donc totalement la cotisation. Conséquence concrète : un admin
-- réclame "41 €" (36 € d'amendes réelles + 5 € de cotisation) via le récap,
-- encaisse un paiement de 45 €, mais le solde affiché partout ailleurs
-- retombe sur 45 − 36 = +9 € au lieu de +4 € attendu.
--
-- Fix : un mois clos génère désormais une vraie ligne `amendes` par membre
-- concerné (motif_id null, libellé "Cotisation mensuelle MM/YYYY"), marquée
-- via la nouvelle colonne `cotisation_mois`. Tous les écrans qui somment déjà
-- `amendes` (v_membre_situation, Dettes, popup, podium, PDF,
-- situation_membre_par_mois) deviennent donc corrects sans aucune
-- modification de leur côté. Seul situation_caisse_mois doit changer, pour
-- ne plus additionner sa cotisation "virtuelle" par-dessus une cotisation
-- déjà matérialisée (double comptage), tout en continuant à donner une
-- estimation pour le mois en cours (pas encore clos, donc pas encore généré).

------------------------------------------------------------------------------
-- 1. Colonne de marquage + unicité (idempotence de la génération)
------------------------------------------------------------------------------
alter table public.amendes
  add column cotisation_mois date;

comment on column public.amendes.cotisation_mois is
  'Non-null uniquement pour une ligne auto-générée par generer_cotisations_mois '
  '(1er jour du mois concerné) — distingue une cotisation matérialisée d''une '
  'amende déclarée manuellement. Null pour toute amende normale.';

create unique index amendes_cotisation_mois_unique
  on public.amendes (membre_id, cotisation_mois)
  where cotisation_mois is not null;

------------------------------------------------------------------------------
-- 2. RPC : génère les lignes de cotisation d'un mois clos pour une caisse
--    Idempotent (ON CONFLICT DO NOTHING) — rejouable sans risque de doublon.
--    Refuse un mois non encore clos (mois courant ou futur) : le montant
--    "plafonné par amendes" doit se calculer sur des amendes définitives.
------------------------------------------------------------------------------
create or replace function public.generer_cotisations_mois(p_caisse_id uuid, p_mois date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debut         date := date_trunc('month', p_mois)::date;
  v_fin           date := (date_trunc('month', p_mois) + interval '1 month')::date;
  v_mois_courant  date := date_trunc('month', (now() at time zone 'Europe/Paris'))::date;
  v_createur      uuid;
  v_inserted      integer;
begin
  if v_debut >= v_mois_courant then
    raise exception 'generer_cotisations_mois : le mois % n''est pas encore clos', v_debut
      using errcode = '22023';
  end if;

  select createur_id into v_createur from public.caisses where id = p_caisse_id;
  if v_createur is null then
    raise exception 'generer_cotisations_mois : caisse % introuvable', p_caisse_id
      using errcode = '22023';
  end if;

  with cfg as (
    select
      coalesce(cotisation_active, false)              as active,
      coalesce(cotisation_montant_centimes, 0)         as montant,
      coalesce(cotisation_plafonnee_par_amendes, false) as plafonnee,
      coalesce(cotisation_solde_pris_en_compte, false)  as solde_pris_en_compte
    from public.caisses
    where id = p_caisse_id
  ),
  amendes_membre as (
    select
      a.membre_id,
      coalesce(sum(a.montant_centimes) filter (
        where (a.created_at at time zone 'Europe/Paris') < v_debut
      ), 0)::integer as avant,
      coalesce(sum(a.montant_centimes) filter (
        where (a.created_at at time zone 'Europe/Paris') >= v_debut
          and (a.created_at at time zone 'Europe/Paris') < v_fin
          and a.cotisation_mois is null
      ), 0)::integer as du_mois_reelles
    from public.amendes a
    where a.caisse_id = p_caisse_id and a.supprimee_at is null
    group by a.membre_id
  ),
  paiements_membre as (
    select
      p.membre_id,
      coalesce(sum(p.montant_centimes) filter (
        where ((p.created_at at time zone 'Europe/Paris') - interval '7 days') < v_debut
      ), 0)::integer as avant,
      coalesce(sum(p.montant_centimes) filter (
        where ((p.created_at at time zone 'Europe/Paris') - interval '7 days') >= v_debut
          and ((p.created_at at time zone 'Europe/Paris') - interval '7 days') < v_fin
      ), 0)::integer as du_mois
    from public.paiements p
    where p.caisse_id = p_caisse_id and p.supprimee_at is null
    group by p.membre_id
  ),
  a_generer as (
    select
      m.id as membre_id,
      (
        case
          when not cfg.active or not m.actif then 0
          when not cfg.plafonnee then cfg.montant
          when not cfg.solde_pris_en_compte then
            greatest(0, cfg.montant - coalesce(am.du_mois_reelles, 0))
          else
            case
              when (
                coalesce(pm.avant, 0) - coalesce(am.avant, 0)
                + coalesce(pm.du_mois, 0) - coalesce(am.du_mois_reelles, 0)
              ) < 0
                then greatest(0, cfg.montant - coalesce(am.du_mois_reelles, 0))
              else 0
            end
        end
      )::integer as montant
    from public.membres m
    left join amendes_membre am on am.membre_id = m.id
    left join paiements_membre pm on pm.membre_id = m.id
    cross join cfg
    where m.caisse_id = p_caisse_id
  )
  insert into public.amendes (
    caisse_id, membre_id, motif_id, libelle, montant_centimes,
    declaree_par_user_id, cotisation_mois, created_at
  )
  select
    p_caisse_id,
    ag.membre_id,
    null,
    'Cotisation mensuelle ' || to_char(v_debut, 'MM/YYYY'),
    ag.montant,
    v_createur,
    v_debut,
    ((v_fin - interval '12 hours') at time zone 'Europe/Paris')
  from a_generer ag
  where ag.montant > 0
  on conflict (membre_id, cotisation_mois) where cotisation_mois is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.generer_cotisations_mois(uuid, date) is
  'Génère (idempotent) les lignes amendes de cotisation d''un mois clos pour '
  'une caisse. Appelée uniquement par le cron mensuel via le service role '
  '(src/app/api/cron/cotisations/route.ts) — jamais exposée à anon/authenticated.';

revoke execute on function public.generer_cotisations_mois(uuid, date) from public;

------------------------------------------------------------------------------
-- 3. situation_caisse_mois : ne plus additionner la cotisation virtuelle
--    quand le mois demandé a déjà une cotisation matérialisée (double
--    comptage), et exclure les lignes de cotisation du calcul de plafond
--    "amendes du mois" (qui doit rester basé sur les amendes réelles).
------------------------------------------------------------------------------
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
          and a.cotisation_mois is null
      ), 0)::integer as du_mois_reelles,
      coalesce(sum(a.montant_centimes) filter (
        where a.cotisation_mois = b.debut
      ), 0)::integer as cotisation_materialisee
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
    coalesce(am.du_mois_reelles, 0)::integer as amendes_mois_centimes,
    cot.cotisation_du_mois::integer as cotisation_mois_centimes,
    coalesce(pm.du_mois, 0)::integer as paiements_mois_centimes,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois_reelles, 0) - cot.cotisation_du_mois)::integer as solde_apres_centimes,
    greatest(0, -(
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois_reelles, 0) - cot.cotisation_du_mois
    ))::integer as montant_a_payer_centimes,
    greatest(0,
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois_reelles, 0) - cot.cotisation_du_mois
    )::integer as avance_centimes
  from public.membres m
  left join amendes_membre am on am.membre_id = m.id
  left join paiements_membre pm on pm.membre_id = m.id
  cross join cfg
  cross join lateral (
    select (
      case
        -- Mois déjà clos et matérialisé : la cotisation est comptée dans
        -- amendes (via cotisation_materialisee), pas de double ajout ici.
        when coalesce(am.cotisation_materialisee, 0) > 0 then 0
        when not cfg.active or not m.actif then 0
        when not cfg.plafonnee then cfg.montant
        when not cfg.solde_pris_en_compte then
          greatest(0, cfg.montant - coalesce(am.du_mois_reelles, 0))
        else
          case
            when (
              coalesce(pm.avant, 0) - coalesce(am.avant, 0)
              + coalesce(pm.du_mois, 0) - coalesce(am.du_mois_reelles, 0)
            ) < 0
              then greatest(0, cfg.montant - coalesce(am.du_mois_reelles, 0))
            else 0
          end
      end
    ) as cotisation_du_mois
  ) cot
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.situation_caisse_mois(uuid, date) to authenticated;

------------------------------------------------------------------------------
-- 4. Backfill : génère les cotisations pour tous les mois déjà clos depuis
--    la création de chaque caisse actuellement cotisation_active. Idempotent
--    (safe à rejouer sur `supabase db reset` en local comme en prod).
------------------------------------------------------------------------------
do $$
declare
  v_caisse  record;
  v_mois    date;
  v_mois_courant date := date_trunc('month', (now() at time zone 'Europe/Paris'))::date;
begin
  for v_caisse in
    select id, created_at from public.caisses where cotisation_active
  loop
    v_mois := date_trunc('month', (v_caisse.created_at at time zone 'Europe/Paris'))::date;
    while v_mois < v_mois_courant loop
      perform public.generer_cotisations_mois(v_caisse.id, v_mois);
      v_mois := (v_mois + interval '1 month')::date;
    end loop;
  end loop;
end $$;
