-- Lien optionnel admin <-> membre.
--
-- Un admin peut aussi être un joueur de l'équipe ; ce lien permet de le
-- rattacher au membre correspondant à la création du compte admin (pas de
-- saisie redondante, transparence sur "qui est qui"). Un membre ne peut être
-- lié qu'à un seul compte admin (index unique partiel, NULLs autorisés en
-- doublon).

alter table public.admins_caisse
  add column membre_id uuid references public.membres(id) on delete set null;

create unique index admins_caisse_membre_id_unique
  on public.admins_caisse (membre_id)
  where membre_id is not null;

comment on column public.admins_caisse.membre_id is
  'Membre de la caisse correspondant à cet admin (optionnel).';

create or replace function public.tg_admins_caisse_check_membre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caisse_membre uuid;
begin
  if new.membre_id is not null then
    select caisse_id into v_caisse_membre from public.membres where id = new.membre_id;
    if v_caisse_membre is null or v_caisse_membre <> new.caisse_id then
      raise exception 'Le membre % n''appartient pas à la caisse %', new.membre_id, new.caisse_id
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger admins_caisse_check_membre
  before insert or update on public.admins_caisse
  for each row execute function public.tg_admins_caisse_check_membre();

-- Redéfinition du trigger d'audit pour inclure membre_id dans le payload.
create or replace function public.tg_log_admin_caisse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.tg_audit('admin.add', 'admins_caisse', new.user_id, new.caisse_id,
      jsonb_build_object('user_id', new.user_id, 'membre_id', new.membre_id));
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
