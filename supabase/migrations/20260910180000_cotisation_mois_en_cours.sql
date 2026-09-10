-- Autorise la génération de la cotisation pour le mois EN COURS (pas
-- seulement un mois clos) : l'admin veut pouvoir déclarer la cotisation dès
-- le début du mois plutôt que d'attendre sa fin. Retire donc le refus "le
-- mois n'est pas encore clos" (20260903100000 / 20260910170000).
--
-- Risque accepté : si la caisse est "plafonnée par amendes", le montant
-- généré se base sur les amendes déjà déclarées au moment du clic, pas sur
-- le total définitif du mois — une amende ajoutée après coup ne rouvre pas
-- le calcul (la cotisation est déjà matérialisée et ne peut être générée
-- qu'une fois par mois, cf. unique index amendes_cotisation_mois_unique).
--
-- L'idempotence "une seule fois par mois" ne change pas : elle vient de cet
-- unique index + ON CONFLICT DO NOTHING dans la requête d'insertion
-- ci-dessous, pas du refus de mois non clos qu'on retire ici.
--
-- Le bouton "Générer la cotisation" (dashboard admin) passe désormais
-- systématiquement le mois en cours (Europe/Paris), plutôt que le mois
-- affiché dans le récapitulatif — voir
-- src/app/(admin)/admin/caisses/[caisseId]/_components/generer-cotisation-button.tsx.

create or replace function public.generer_cotisations_mois(p_caisse_id uuid, p_mois date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debut         date := date_trunc('month', p_mois)::date;
  v_fin           date := (date_trunc('month', p_mois) + interval '1 month')::date;
  v_createur      uuid;
  v_inserted      integer;
begin
  if not (
    public.is_super_admin()
    or (public.is_admin_of(p_caisse_id) and public.caisse_est_ouverte(p_caisse_id))
  ) then
    raise exception 'Non autorisé à générer la cotisation de cette caisse'
      using errcode = '42501';
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
    -- Le mois en cours peut désormais être généré avant sa fin (bouton
    -- "Générer la cotisation") : on utilise l'horodatage réel s'il tombe
    -- bien dans le mois ciblé, sinon (génération d'un mois passé) on
    -- retombe sur l'ancien repère "juste avant la fin du mois" pour que
    -- recap_mensuel_simple continue de l'attribuer au bon mois calendaire.
    case
      when (now() at time zone 'Europe/Paris') >= v_debut
        and (now() at time zone 'Europe/Paris') < v_fin
      then now()
      else ((v_fin - interval '12 hours') at time zone 'Europe/Paris')
    end
  from a_generer ag
  where ag.montant > 0
  on conflict (membre_id, cotisation_mois) where cotisation_mois is not null do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.generer_cotisations_mois(uuid, date) is
  'Génère (idempotent, une seule fois par mois via unique index) les lignes '
  'amendes de cotisation d''un mois pour une caisse — y compris le mois en '
  'cours. Déclenchée manuellement par un admin (bouton "Générer la '
  'cotisation" du dashboard) ; vérifie elle-même is_admin_of/is_super_admin.';
