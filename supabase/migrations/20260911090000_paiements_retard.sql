-- Paiements en retard : pénalité de 2€ par jour de retard, ajoutée
-- automatiquement au montant du paiement.
--
-- Comme pour jour_match sur les amendes (cf. 20260806110000), le flag et le
-- nombre de jours sont portés par la ligne de paiement elle-même : le
-- formulaire n'envoie que le montant de base + le nombre de jours de
-- retard déclarés, et c'est le trigger BEFORE INSERT qui calcule le
-- montant final (CDC 8.1 #1 : aucune logique métier dans le frontend, le
-- formulaire n'affiche qu'un aperçu indicatif). Le paiement restant
-- immuable après insertion, la pénalité est figée dès l'enregistrement.

alter table public.paiements
  add column retard boolean not null default false,
  add column jours_retard smallint not null default 0;

alter table public.paiements
  add constraint paiements_retard_coherent check (
    (retard = false and jours_retard = 0)
    or (retard = true and jours_retard >= 1)
  );

comment on column public.paiements.retard is
  'true = paiement enregistré en retard, pénalité de 2€/jour ajoutée automatiquement à montant_centimes à l''insertion (voir tg_paiements_appliquer_retard).';
comment on column public.paiements.jours_retard is
  'Nombre de jours de retard déclarés (0 si retard = false). Pénalité = jours_retard × 200 centimes, ajoutée à montant_centimes par le trigger.';

create or replace function public.tg_paiements_appliquer_retard()
returns trigger
language plpgsql
as $$
begin
  if new.retard then
    new.montant_centimes := new.montant_centimes + new.jours_retard * 200;
  end if;
  return new;
end;
$$;

create trigger paiements_appliquer_retard
  before insert on public.paiements
  for each row execute function public.tg_paiements_appliquer_retard();

-- Étend tg_paiements_restrict_update (20260430120006) aux nouvelles
-- colonnes : un paiement (y compris son statut retard) ne peut plus être
-- modifié après coup, seul le soft-delete reste autorisé. La fonction est
-- remplacée ; le trigger existant reste attaché dessus.
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
     or new.retard is distinct from old.retard
     or new.jours_retard is distinct from old.jours_retard
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
