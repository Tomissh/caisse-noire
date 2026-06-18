-- Phase 4.D.1 : triggers audit_log pour caisses, membres, admins_caisse,
-- motifs_amende.
--
-- Convention :
--   - actions : <entité>.<verbe> (caisse.create, membre.update, ...)
--   - payload : pour UPDATE, on stocke un diff jsonb { col: [old, new] } pour
--     les colonnes ayant changé. Pour CREATE/DELETE, on stocke les champs clés
--     (libellé, montant, etc.) pour rester lisible.
--   - Cas particuliers détectés par les triggers eux-mêmes :
--       * caisses UPDATE : cloturee_at NULL→ts = caisse.cloture, ts→NULL = caisse.reouverture
--       * membres UPDATE : password_hash changé = membre.set_password
--       * motifs_amende UPDATE : actif toggle = motif.deactivate / motif.reactivate

-- Le trigger caisses_audit existait déjà depuis Phase 2 mais ne traçait que
-- INSERT, cloture et reouverture. On le remplace pour ajouter le suivi des
-- UPDATE nom/description/code et le DELETE.
drop trigger if exists caisses_audit on public.caisses;

------------------------------------------------------------------------------
-- caisses
------------------------------------------------------------------------------
create or replace function public.tg_log_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('caisse.create', 'caisses', new.id, new.id,
      jsonb_build_object('nom', new.nom, 'code', new.code));
    return new;
  end if;

  if (tg_op = 'DELETE') then
    perform public.tg_audit('caisse.delete', 'caisses', old.id, old.id,
      jsonb_build_object('nom', old.nom));
    return old;
  end if;

  -- UPDATE
  if (old.cloturee_at is null and new.cloturee_at is not null) then
    perform public.tg_audit('caisse.cloture', 'caisses', new.id, new.id, '{}'::jsonb);
    return new;
  end if;
  if (old.cloturee_at is not null and new.cloturee_at is null) then
    perform public.tg_audit('caisse.reouverture', 'caisses', new.id, new.id, '{}'::jsonb);
    return new;
  end if;

  if (old.nom is distinct from new.nom) then
    v_payload := v_payload || jsonb_build_object('nom', jsonb_build_array(old.nom, new.nom));
  end if;
  if (old.description is distinct from new.description) then
    v_payload := v_payload || jsonb_build_object('description', jsonb_build_array(old.description, new.description));
  end if;
  if (old.code is distinct from new.code) then
    v_payload := v_payload || jsonb_build_object('code', jsonb_build_array(old.code, new.code));
  end if;
  if (v_payload <> '{}'::jsonb) then
    perform public.tg_audit('caisse.update', 'caisses', new.id, new.id, v_payload);
  end if;
  return new;
end;
$$;

create trigger caisses_audit
  after insert or update or delete on public.caisses
  for each row execute function public.tg_log_caisse();

------------------------------------------------------------------------------
-- membres
------------------------------------------------------------------------------
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
      jsonb_build_object('prenom', new.prenom, 'nom', new.nom));
    return new;
  end if;

  if (tg_op = 'DELETE') then
    perform public.tg_audit('membre.delete', 'membres', old.id, old.caisse_id,
      jsonb_build_object('prenom', old.prenom, 'nom', old.nom));
    return old;
  end if;

  -- UPDATE
  if (old.password_hash is distinct from new.password_hash) then
    perform public.tg_audit('membre.set_password', 'membres', new.id, new.caisse_id, '{}'::jsonb);
    -- Continue pour potentiellement logger d'autres changements ensemble
  end if;

  if (old.prenom is distinct from new.prenom) then
    v_payload := v_payload || jsonb_build_object('prenom', jsonb_build_array(old.prenom, new.prenom));
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

create trigger membres_audit
  after insert or update or delete on public.membres
  for each row execute function public.tg_log_membre();

------------------------------------------------------------------------------
-- admins_caisse
------------------------------------------------------------------------------
create or replace function public.tg_log_admin_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('admin.add', 'admins_caisse', new.user_id, new.caisse_id,
      jsonb_build_object('user_id', new.user_id));
    return new;
  end if;
  if (tg_op = 'DELETE') then
    perform public.tg_audit('admin.remove', 'admins_caisse', old.user_id, old.caisse_id,
      jsonb_build_object('user_id', old.user_id));
    return old;
  end if;
  return null;
end;
$$;

create trigger admins_caisse_audit
  after insert or delete on public.admins_caisse
  for each row execute function public.tg_log_admin_caisse();

------------------------------------------------------------------------------
-- motifs_amende
------------------------------------------------------------------------------
create or replace function public.tg_log_motif()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := '{}'::jsonb;
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('motif.create', 'motifs_amende', new.id, new.caisse_id,
      jsonb_build_object('libelle', new.libelle, 'montant_centimes', new.montant_centimes,
                        'montant_variable', new.montant_variable));
    return new;
  end if;
  if (tg_op = 'DELETE') then
    perform public.tg_audit('motif.delete', 'motifs_amende', old.id, old.caisse_id,
      jsonb_build_object('libelle', old.libelle));
    return old;
  end if;

  -- UPDATE
  if (old.actif is distinct from new.actif) then
    if (new.actif) then
      perform public.tg_audit('motif.reactivate', 'motifs_amende', new.id, new.caisse_id, '{}'::jsonb);
    else
      perform public.tg_audit('motif.deactivate', 'motifs_amende', new.id, new.caisse_id, '{}'::jsonb);
    end if;
  end if;

  if (old.libelle is distinct from new.libelle) then
    v_payload := v_payload || jsonb_build_object('libelle', jsonb_build_array(old.libelle, new.libelle));
  end if;
  if (old.montant_centimes is distinct from new.montant_centimes) then
    v_payload := v_payload || jsonb_build_object('montant_centimes', jsonb_build_array(old.montant_centimes, new.montant_centimes));
  end if;
  if (old.montant_variable is distinct from new.montant_variable) then
    v_payload := v_payload || jsonb_build_object('montant_variable', jsonb_build_array(old.montant_variable, new.montant_variable));
  end if;
  if (v_payload <> '{}'::jsonb) then
    perform public.tg_audit('motif.update', 'motifs_amende', new.id, new.caisse_id, v_payload);
  end if;
  return new;
end;
$$;

create trigger motifs_amende_audit
  after insert or update or delete on public.motifs_amende
  for each row execute function public.tg_log_motif();
