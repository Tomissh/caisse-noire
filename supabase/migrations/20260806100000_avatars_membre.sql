-- Photos de profil des membres — Supabase Storage.
--
-- Bucket privé "avatars", un objet par membre à un chemin déterministe
-- `${caisse_id}/${membre_id}/avatar` (pas de colonne DB : l'existence de
-- l'objet fait foi, le client tente createSignedUrl et retombe sur l'avatar
-- par défaut en cas d'échec).
--
-- RLS storage.objects (déjà activée par défaut sur ce schéma Supabase) :
--   - lecture  : membres/admins de la même caisse (transparence, cohérent
--     avec le reste de l'app) ou super-admin
--   - écriture (insert/update/delete) : le membre uniquement, sur son propre
--     dossier — vérifié via le 2e segment du chemin = current_membre_id()

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  3145728, -- 3 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy avatars_select
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_super_admin()
      or public.is_admin_of(((storage.foldername(name))[1])::uuid)
      or public.is_membre_of(((storage.foldername(name))[1])::uuid)
    )
  );

create policy avatars_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.is_membre_of(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = public.current_membre_id()::text
  );

create policy avatars_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_membre_of(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = public.current_membre_id()::text
  )
  with check (
    bucket_id = 'avatars'
    and public.is_membre_of(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = public.current_membre_id()::text
  );

create policy avatars_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_membre_of(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = public.current_membre_id()::text
  );
