-- Signalé par `supabase db advisors` (security) : l'extension `citext` était
-- installée dans le schéma `public` au lieu du schéma dédié `extensions`
-- (convention Supabase — évite de mélanger objets applicatifs et objets
-- d'extension dans le même schéma exposé par l'API).
--
-- Vérifié : `citext` n'est utilisée par aucune colonne du projet (aucun
-- type de colonne ne la référence dans les migrations) — déplacement sans
-- impact fonctionnel.

alter extension citext set schema extensions;
