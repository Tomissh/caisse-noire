-- Triggers
-- Caisse Noire v2 — Phase 2

------------------------------------------------------------------------------
-- 1. updated_at automatique
------------------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger caisses_set_updated_at
  before update on public.caisses
  for each row execute function public.tg_set_updated_at();

create trigger membres_set_updated_at
  before update on public.membres
  for each row execute function public.tg_set_updated_at();

create trigger motifs_amende_set_updated_at
  before update on public.motifs_amende
  for each row execute function public.tg_set_updated_at();

------------------------------------------------------------------------------
-- 2. Cohérence caisse_id : amendes/paiements doivent pointer un membre de la
--    même caisse, et un motif_amende de la même caisse.
------------------------------------------------------------------------------
create or replace function public.tg_amendes_check_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_membre uuid;
  v_caisse_motif  uuid;
begin
  select caisse_id into v_caisse_membre from public.membres where id = new.membre_id;
  if v_caisse_membre is null or v_caisse_membre <> new.caisse_id then
    raise exception 'Le membre % n''appartient pas à la caisse %', new.membre_id, new.caisse_id
      using errcode = '23514';
  end if;

  if new.motif_id is not null then
    select caisse_id into v_caisse_motif from public.motifs_amende where id = new.motif_id;
    if v_caisse_motif is null or v_caisse_motif <> new.caisse_id then
      raise exception 'Le motif % n''appartient pas à la caisse %', new.motif_id, new.caisse_id
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger amendes_check_caisse
  before insert or update on public.amendes
  for each row execute function public.tg_amendes_check_caisse();

create or replace function public.tg_paiements_check_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_membre uuid;
begin
  select caisse_id into v_caisse_membre from public.membres where id = new.membre_id;
  if v_caisse_membre is null or v_caisse_membre <> new.caisse_id then
    raise exception 'Le membre % n''appartient pas à la caisse %', new.membre_id, new.caisse_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger paiements_check_caisse
  before insert or update on public.paiements
  for each row execute function public.tg_paiements_check_caisse();

------------------------------------------------------------------------------
-- 3. Retraits immuables : pas d'UPDATE, pas de DELETE, jamais.
------------------------------------------------------------------------------
create or replace function public.tg_retraits_immutables()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Les retraits sont immuables. Pour corriger, ajouter un retrait avec un montant négatif compensatoire.'
    using errcode = '42501';
end;
$$;

create trigger retraits_no_update
  before update on public.retraits
  for each row execute function public.tg_retraits_immutables();

create trigger retraits_no_delete
  before delete on public.retraits
  for each row execute function public.tg_retraits_immutables();

------------------------------------------------------------------------------
-- 4. caisses : restriction des colonnes modifiables selon rôle
--    - cloturee_at : créateur (clôture seulement) + super_admin (clôture/réouv)
--    - createur_id : super_admin seulement
--    - code        : créateur + super_admin (admin ne peut pas)
--    Admin (non créateur) : nom, description seulement.
------------------------------------------------------------------------------
create or replace function public.tg_caisses_restrict_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super   boolean := public.is_super_admin();
  v_is_creator boolean := (old.createur_id = auth.uid());
begin
  if v_is_super then
    return new;
  end if;

  if new.createur_id is distinct from old.createur_id then
    raise exception 'Seul un super-admin peut transférer la propriété d''une caisse'
      using errcode = '42501';
  end if;

  if new.cloturee_at is distinct from old.cloturee_at then
    if not v_is_creator then
      raise exception 'Seul le créateur peut clôturer cette caisse'
        using errcode = '42501';
    end if;
    if old.cloturee_at is not null and new.cloturee_at is null then
      raise exception 'Seul un super-admin peut réouvrir une caisse clôturée'
        using errcode = '42501';
    end if;
  end if;

  if new.code is distinct from old.code and not v_is_creator then
    raise exception 'Seul le créateur peut modifier le code de la caisse'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger caisses_restrict_update
  before update on public.caisses
  for each row execute function public.tg_caisses_restrict_update();

------------------------------------------------------------------------------
-- 5. Soft-delete amendes/paiements : seuls (supprimee_at, supprimee_par_user_id,
--    motif_suppression) peuvent être modifiés via UPDATE direct. Toute autre
--    modification est interdite (utiliser INSERT pour nouvelle amende/paiement).
--    Annulation d'un soft-delete (set supprimee_at=null) interdite.
------------------------------------------------------------------------------
create or replace function public.tg_amendes_restrict_update()
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
     or new.motif_id is distinct from old.motif_id
     or new.libelle is distinct from old.libelle
     or new.montant_centimes is distinct from old.montant_centimes
     or new.declaree_par_user_id is distinct from old.declaree_par_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Une amende ne peut pas être modifiée. Seul le soft-delete est autorisé.'
      using errcode = '42501';
  end if;

  if old.supprimee_at is not null and new.supprimee_at is null then
    raise exception 'Annulation de suppression d''amende interdite (passer par super-admin).'
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

create trigger amendes_restrict_update
  before update on public.amendes
  for each row execute function public.tg_amendes_restrict_update();

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

create trigger paiements_restrict_update
  before update on public.paiements
  for each row execute function public.tg_paiements_restrict_update();

------------------------------------------------------------------------------
-- 6. audit_log : remplissage automatique sur INSERT des entités sensibles
------------------------------------------------------------------------------
create or replace function public.tg_audit(
  p_action      text,
  p_entite_type text,
  p_entite_id   uuid,
  p_caisse_id   uuid,
  p_payload     jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log
    (caisse_id, action, entite_type, entite_id,
     acteur_user_id, acteur_membre_id, payload)
  values
    (p_caisse_id, p_action, p_entite_type, p_entite_id,
     auth.uid(), public.current_membre_id(), coalesce(p_payload, '{}'::jsonb));
$$;

create or replace function public.tg_log_amende()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('amende.create', 'amendes', new.id, new.caisse_id,
      jsonb_build_object(
        'membre_id', new.membre_id,
        'montant_centimes', new.montant_centimes,
        'libelle', new.libelle));
  elsif (tg_op = 'UPDATE'
         and old.supprimee_at is null
         and new.supprimee_at is not null) then
    perform public.tg_audit('amende.delete', 'amendes', new.id, new.caisse_id,
      jsonb_build_object('motif_suppression', new.motif_suppression));
  end if;
  return new;
end;
$$;

create trigger amendes_audit
  after insert or update on public.amendes
  for each row execute function public.tg_log_amende();

create or replace function public.tg_log_paiement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('paiement.create', 'paiements', new.id, new.caisse_id,
      jsonb_build_object(
        'membre_id', new.membre_id,
        'montant_centimes', new.montant_centimes,
        'moyen', new.moyen));
  elsif (tg_op = 'UPDATE'
         and old.supprimee_at is null
         and new.supprimee_at is not null) then
    perform public.tg_audit('paiement.delete', 'paiements', new.id, new.caisse_id,
      jsonb_build_object('motif_suppression', new.motif_suppression));
  end if;
  return new;
end;
$$;

create trigger paiements_audit
  after insert or update on public.paiements
  for each row execute function public.tg_log_paiement();

create or replace function public.tg_log_retrait()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.tg_audit('retrait.create', 'retraits', new.id, new.caisse_id,
    jsonb_build_object(
      'montant_centimes', new.montant_centimes,
      'libelle', new.libelle));
  return new;
end;
$$;

create trigger retraits_audit
  after insert on public.retraits
  for each row execute function public.tg_log_retrait();

create or replace function public.tg_log_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('caisse.create', 'caisses', new.id, new.id,
      jsonb_build_object('nom', new.nom));
  elsif (tg_op = 'UPDATE') then
    if old.cloturee_at is null and new.cloturee_at is not null then
      perform public.tg_audit('caisse.cloture', 'caisses', new.id, new.id,
        jsonb_build_object('cloturee_at', new.cloturee_at));
    elsif old.cloturee_at is not null and new.cloturee_at is null then
      perform public.tg_audit('caisse.reouverture', 'caisses', new.id, new.id, '{}'::jsonb);
    end if;
  end if;
  return new;
end;
$$;

create trigger caisses_audit
  after insert or update on public.caisses
  for each row execute function public.tg_log_caisse();
