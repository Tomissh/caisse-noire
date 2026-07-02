-- Grants CRUD aux rôles applicatifs Supabase (anon, authenticated, service_role).
--
-- Problème observé : les ALTER DEFAULT PRIVILEGES owned by `postgres` (rôle
-- effectif quand `supabase db reset` rejoue les migrations en local CLI) ne
-- donnent que D-x-t-m (DELETE, TRUNCATE, REFERENCES, TRIGGER). Manque SELECT,
-- INSERT, UPDATE → permission denied côté service_role même avec RLS bypass.
--
-- En prod cloud Supabase les migrations sont appliquées avec un rôle qui a les
-- defaults complets, donc le problème ne se manifeste qu'en local. Cette
-- migration est inoffensive en prod (re-grant idempotent).
--
-- La RLS continue de filtrer les lignes accessibles selon le rôle/JWT —
-- ces GRANTs ne contournent PAS la RLS.

grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;

grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Defaults pour les futures tables/sequences/functions créées dans public.
alter default privileges in schema public
  grant select, insert, update, delete on tables
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant usage, select on sequences
  to anon, authenticated, service_role;

alter default privileges in schema public
  grant execute on functions
  to anon, authenticated, service_role;
