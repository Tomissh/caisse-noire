-- Durcissement avant ouverture d'accès à d'autres personnes.
--
-- Détecté par `supabase db advisors --type security` : PostgreSQL accorde
-- EXECUTE à PUBLIC par défaut sur toute fonction nouvellement créée, sauf
-- révocation explicite. Nos migrations précédentes accordaient bien EXECUTE
-- à `authenticated` (et parfois `anon`) là où c'est voulu, mais ne
-- révoquaient jamais PUBLIC — qui reste donc, en plus, valable pour tous les
-- rôles (y compris `anon`, la clé publique embarquée dans le navigateur).
--
-- Impact concret le plus sérieux : `tg_audit` (SECURITY DEFINER, appelée en
-- interne par les triggers `tg_log_*` pour journaliser dans `audit_log`,
-- table dont la RLS n'autorise AUCUN insert direct) était appelable
-- directement via RPC par n'importe quel utilisateur authentifié — ou même
-- anonyme. Un admin d'une caisse aurait pu forger une entrée d'audit pour
-- n'importe quelle autre caisse (entite_id/payload arbitraires), polluant
-- un journal censé faire foi.
--
-- Fix : révoquer EXECUTE de PUBLIC sur les fonctions internes (triggers,
-- tg_audit) et sur les RPC sensibles déjà restreintes à `authenticated`
-- (supprimer_amende, supprimer_paiement, cloturer_caisse, reouvrir_caisse)
-- — l'appel interne trigger → tg_audit continue de fonctionner, ces
-- fonctions s'exécutant avec les droits du propriétaire (SECURITY DEFINER).
-- Les fonctions volontairement ouvertes à anon (helpers is_*,
-- resolve_username_email, situation_membre_par_mois) ne sont pas touchées :
-- leur grant explicite reste inchangé.

revoke execute on function public.tg_set_updated_at() from public;
revoke execute on function public.tg_amendes_check_caisse() from public;
revoke execute on function public.tg_paiements_check_caisse() from public;
revoke execute on function public.tg_retraits_immutables() from public;
revoke execute on function public.tg_caisses_restrict_update() from public;
revoke execute on function public.tg_amendes_restrict_update() from public;
revoke execute on function public.tg_paiements_restrict_update() from public;
revoke execute on function public.tg_log_amende() from public;
revoke execute on function public.tg_log_paiement() from public;
revoke execute on function public.tg_log_retrait() from public;
revoke execute on function public.tg_log_caisse() from public;
revoke execute on function public.tg_log_membre() from public;
revoke execute on function public.tg_log_admin_caisse() from public;
revoke execute on function public.tg_log_motif() from public;
revoke execute on function public.tg_amendes_appliquer_jour_match() from public;
revoke execute on function public.tg_admins_caisse_check_membre() from public;
revoke execute on function public.tg_audit(text, text, uuid, uuid, jsonb) from public;

revoke execute on function public.supprimer_amende(uuid, text) from public;
revoke execute on function public.supprimer_paiement(uuid, text) from public;
revoke execute on function public.cloturer_caisse(uuid) from public;
revoke execute on function public.reouvrir_caisse(uuid) from public;

-- search_path non figé (avertissement advisor `function_search_path_mutable`)
-- — ces 3 triggers n'en avaient pas, contrairement aux autres fonctions du
-- projet qui posent systématiquement `set search_path = public`.
alter function public.tg_set_updated_at() set search_path = public;
alter function public.tg_retraits_immutables() set search_path = public;
alter function public.tg_amendes_appliquer_jour_match() set search_path = public;
