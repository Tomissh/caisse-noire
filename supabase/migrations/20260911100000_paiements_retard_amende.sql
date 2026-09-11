-- Retour arrière + correction de 20260911090000_paiements_retard.sql.
--
-- Erreur de conception initiale : le retard ne doit PAS gonfler le montant
-- du paiement lui-même (montant_centimes = ce que la personne a réellement
-- payé). C'est une amende distincte, ajoutée au membre, comme n'importe
-- quelle autre amende — elle s'ajoute au total dû, elle ne se déduit pas
-- du paiement.
--
-- Exemple : un membre doit 10€, paie 20€ avec 3 jours de retard (6€
-- d'amende). Paiement enregistré = 20€. Amende "Retard de paiement (3
-- jours)" = 6€. Total dû = 10 + 6 = 16€, total payé = 20€, solde = +4€.
--
-- Retrait des colonnes/trigger ajoutés par erreur sur `paiements`, et ajout
-- d'une RPC `enregistrer_paiement` qui insère atomiquement le paiement +
-- (si jours de retard > 0) l'amende de retard correspondante, dans une
-- seule fonction SECURITY DEFINER — pattern déjà utilisé pour
-- supprimer_amende / supprimer_paiement / generer_cotisations_mois (CDC
-- 8.1 #1 : logique métier en base, pas dans le frontend). Les triggers
-- existants (check_caisse, audit) s'appliquent normalement aux deux INSERT
-- puisque ce sont de vrais INSERT sur les tables, pas un contournement.

drop trigger if exists paiements_appliquer_retard on public.paiements;
drop function if exists public.tg_paiements_appliquer_retard();

alter table public.paiements
  drop constraint if exists paiements_retard_coherent;

alter table public.paiements
  drop column if exists retard,
  drop column if exists jours_retard;

-- Redevient la version de 20260430120006 (colonnes retard/jours_retard
-- retirées de la liste protégée, elles n'existent plus).
create or replace function public.tg_paiements_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.caisse_id is distinct from old.caisse_id
     or new.membre_id is distinct from old.membre_id
     or new.montant_centimes is distinct from old.montant_centimes
     or new.moyen is distinct from old.moyen
     or new.enregistre_par_user_id is distinct from old.enregistre_par_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un paiement ne peut pas être modifié. Seul le soft-delete est autorisé.'
      using errcode = '42501';
  end if;

  if old.supprimee_at is not null and new.supprimee_at is null then
    raise exception 'Annulation de suppression de paiement interdite (passer par super-admin).'
      using errcode = '42501';
  end if;

  if new.supprimee_par_user_id is not null
     and new.supprimee_par_user_id <> auth.uid() then
    raise exception 'supprimee_par_user_id doit correspondre à l''utilisateur authentifié.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------
-- RPC : enregistrer un paiement, avec amende de retard optionnelle
------------------------------------------------------------------------------
create or replace function public.enregistrer_paiement(
  p_caisse_id uuid,
  p_membre_id uuid,
  p_montant_centimes integer,
  p_moyen public.moyen_paiement,
  p_jours_retard smallint default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paiement_id uuid;
begin
  if not (public.is_super_admin()
          or (public.is_admin_of(p_caisse_id)
              and public.caisse_est_ouverte(p_caisse_id))) then
    raise exception 'Non autorisé à enregistrer un paiement pour cette caisse'
      using errcode = '42501';
  end if;

  if p_montant_centimes <= 0 or p_montant_centimes % 100 <> 0 then
    raise exception 'Montant de paiement invalide'
      using errcode = '22023';
  end if;

  if p_jours_retard < 0 then
    raise exception 'Le nombre de jours de retard ne peut pas être négatif'
      using errcode = '22023';
  end if;

  insert into public.paiements
    (caisse_id, membre_id, montant_centimes, moyen, enregistre_par_user_id)
  values
    (p_caisse_id, p_membre_id, p_montant_centimes, p_moyen, auth.uid())
  returning id into v_paiement_id;

  if p_jours_retard > 0 then
    insert into public.amendes
      (caisse_id, membre_id, motif_id, libelle, montant_centimes, declaree_par_user_id)
    values (
      p_caisse_id,
      p_membre_id,
      null,
      'Retard de paiement (' || p_jours_retard
        || case when p_jours_retard > 1 then ' jours)' else ' jour)' end,
      p_jours_retard::integer * 200,
      auth.uid()
    );
  end if;

  return v_paiement_id;
end;
$$;

revoke execute on function public.enregistrer_paiement(uuid, uuid, integer, public.moyen_paiement, smallint) from anon;
grant execute on function public.enregistrer_paiement(uuid, uuid, integer, public.moyen_paiement, smallint) to authenticated;
