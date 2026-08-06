-- Fusion prénom + nom en un seul champ "nom" — simplifie la saisie et la
-- connexion membre (un seul champ à faire correspondre au lieu de deux).
--
-- Les données existantes sont préservées par concaténation ("Prénom Nom")
-- dans la colonne `nom` avant suppression de `prenom`, pour ne perdre aucune
-- identité déjà saisie.

update public.membres
set nom = trim(prenom || ' ' || nom);

drop index if exists public.membres_caisse_identite_unique;

create unique index membres_caisse_nom_unique
  on public.membres (caisse_id, lower(nom));

alter table public.membres
  drop column prenom;

-- Trigger d'audit membres : retire prenom du payload.
create or replace function public.tg_log_membre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('membre.create', 'membres', new.id, new.caisse_id,
      jsonb_build_object('nom', new.nom));
    return new;
  end if;

  if (tg_op = 'DELETE') then
    perform public.tg_audit('membre.delete', 'membres', old.id, old.caisse_id,
      jsonb_build_object('nom', old.nom));
    return old;
  end if;

  -- UPDATE
  if (old.password_hash is distinct from new.password_hash) then
    perform public.tg_audit('membre.set_password', 'membres', new.id, new.caisse_id, '{}'::jsonb);
    -- Continue pour potentiellement logger d'autres changements ensemble
  end if;

  if (old.nom is distinct from new.nom) then
    v_payload := v_payload || jsonb_build_object('nom', jsonb_build_array(old.nom, new.nom));
  end if;
  if (old.actif is distinct from new.actif) then
    v_payload := v_payload || jsonb_build_object('actif', jsonb_build_array(old.actif, new.actif));
  end if;
  if (v_payload <> '{}'::jsonb) then
    perform public.tg_audit('membre.update', 'membres', new.id, new.caisse_id, v_payload);
  end if;
  return new;
end;
$$;

-- situation_caisse_mois : le type de retour change (colonne `prenom`
-- supprimée), CREATE OR REPLACE ne le permet pas -> drop puis recreate.
drop function if exists public.situation_caisse_mois(uuid, date);

create function public.situation_caisse_mois(p_caisse_id uuid, p_mois date)
returns table (
  membre_id                 uuid,
  nom                       text,
  actif                     boolean,
  solde_avant_centimes      integer,
  amendes_mois_centimes     integer,
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
    coalesce(pm.du_mois, 0)::integer as paiements_mois_centimes,
    (coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0))::integer as solde_apres_centimes,
    greatest(0, -(
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0)
    ))::integer as montant_a_payer_centimes,
    greatest(0,
      coalesce(pm.avant, 0) - coalesce(am.avant, 0)
      + coalesce(pm.du_mois, 0) - coalesce(am.du_mois, 0)
    )::integer as avance_centimes
  from public.membres m
  left join amendes_membre am on am.membre_id = m.id
  left join paiements_membre pm on pm.membre_id = m.id
  where m.caisse_id = p_caisse_id
  order by m.nom;
$$;

grant execute on function public.situation_caisse_mois(uuid, date) to authenticated;
