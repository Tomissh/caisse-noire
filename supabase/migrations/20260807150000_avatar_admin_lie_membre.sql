-- Un admin peut être lié à un membre de la caisse (admins_caisse.membre_id,
-- cf. 20260806120000). Jusqu'ici, seul ce membre lui-même — connecté via le
-- portail (membre) et son JWT custom — pouvait envoyer/modifier sa photo de
-- profil (bucket "avatars", policies scoping sur current_membre_id()).
--
-- On étend l'écriture (insert/update/delete) du dossier avatar du membre
-- lié à l'admin correspondant, pour qu'il puisse gérer sa photo directement
-- depuis l'espace admin, sans devoir se connecter en plus côté membre.

create or replace function public.is_linked_admin_membre(p_membre_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins_caisse
    where user_id = auth.uid()
      and membre_id = p_membre_id
  );
$$;

grant execute on function public.is_linked_admin_membre(uuid) to authenticated;

drop policy avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (public.is_membre_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] = public.current_membre_id()::text)
      or public.is_linked_admin_membre(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (public.is_membre_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] = public.current_membre_id()::text)
      or public.is_linked_admin_membre(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (public.is_membre_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] = public.current_membre_id()::text)
      or public.is_linked_admin_membre(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (public.is_membre_of(((storage.foldername(name))[1])::uuid)
        and (storage.foldername(name))[2] = public.current_membre_id()::text)
      or public.is_linked_admin_membre(((storage.foldername(name))[2])::uuid)
    )
  );
