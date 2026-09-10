-- Retrait de l'automatisation cron de la cotisation mensuelle : il n'y a
-- pas de notion de "clôture du mois en cours" dans l'app (contrairement à
-- la clôture de caisse), donc rien ne signalait fiablement à un cron qu'un
-- mois était "terminé" — le cron se contentait de supposer que le mois
-- précédent la date du jour était clos. Remplacé par un déclenchement
-- manuel : un bouton "Générer la cotisation" à côté du classement à
-- réclamer (dashboard admin), qui appelle generer_cotisations_mois pour le
-- mois actuellement affiché.
--
-- generer_cotisations_mois était jusqu'ici appelée uniquement par le cron
-- via le service role (aucune notion d'utilisateur authentifié). Comme
-- elle est désormais appelée directement par un admin depuis le client
-- (RPC via le client de session), on ajoute la même vérification
-- d'autorisation que cloturer_caisse/supprimer_amende (is_super_admin OU
-- is_admin_of + caisse ouverte) plutôt que de faire confiance à la seule
-- Server Action côté Next — la fonction reste sûre même appelée
-- directement en RPC.

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
  if not (
    public.is_super_admin()
    or (public.is_admin_of(p_caisse_id) and public.caisse_est_ouverte(p_caisse_id))
  ) then
    raise exception 'Non autorisé à générer la cotisation de cette caisse'
      using errcode = '42501';
  end if;

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
  'une caisse. Déclenchée manuellement par un admin (bouton "Générer la '
  'cotisation" du dashboard) — vérifie elle-même is_admin_of/is_super_admin, '
  'pas de dépendance à un cron.';

revoke execute on function public.generer_cotisations_mois(uuid, date) from public, anon;
grant execute on function public.generer_cotisations_mois(uuid, date) to authenticated;
