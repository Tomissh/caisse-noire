-- Correctif de 20260807120000_durcissement_grants_fonctions.sql.
--
-- Cette migration révoquait EXECUTE de PUBLIC, en pensant fermer l'accès
-- anonyme/authentifié implicite. Vérification après coup (pg_proc.proacl) :
-- ça n'a rien changé. Supabase configure par défaut, au niveau du schéma
-- `public`, des privilèges par défaut (`alter default privileges ... grant
-- execute on functions to anon, authenticated, service_role`) — chaque
-- fonction nouvellement créée reçoit donc EXECUTE accordé *explicitement* à
-- `anon` et `authenticated` dès sa création, indépendamment de PUBLIC.
-- Révoquer PUBLIC ne touche pas ces grants explicites.
--
-- Le vrai fix : révoquer EXECUTE directement sur `anon`/`authenticated` pour
-- les fonctions internes (triggers, tg_audit) qui ne doivent être appelables
-- que depuis d'autres fonctions SECURITY DEFINER (lesquelles s'exécutent
-- avec les droits du propriétaire, donc pas besoin d'un grant à
-- `authenticated` pour que la chaîne de triggers continue de fonctionner).
--
-- Pour les 4 RPC sensibles déjà voulues `authenticated`-only
-- (supprimer_amende, supprimer_paiement, cloturer_caisse, reouvrir_caisse),
-- seul `anon` est révoqué — `authenticated` reste, c'est l'accès voulu.

revoke execute on function public.tg_set_updated_at() from anon, authenticated;
revoke execute on function public.tg_amendes_check_caisse() from anon, authenticated;
revoke execute on function public.tg_paiements_check_caisse() from anon, authenticated;
revoke execute on function public.tg_retraits_immutables() from anon, authenticated;
revoke execute on function public.tg_caisses_restrict_update() from anon, authenticated;
revoke execute on function public.tg_amendes_restrict_update() from anon, authenticated;
revoke execute on function public.tg_paiements_restrict_update() from anon, authenticated;
revoke execute on function public.tg_log_amende() from anon, authenticated;
revoke execute on function public.tg_log_paiement() from anon, authenticated;
revoke execute on function public.tg_log_retrait() from anon, authenticated;
revoke execute on function public.tg_log_caisse() from anon, authenticated;
revoke execute on function public.tg_log_membre() from anon, authenticated;
revoke execute on function public.tg_log_admin_caisse() from anon, authenticated;
revoke execute on function public.tg_log_motif() from anon, authenticated;
revoke execute on function public.tg_amendes_appliquer_jour_match() from anon, authenticated;
revoke execute on function public.tg_admins_caisse_check_membre() from anon, authenticated;
revoke execute on function public.tg_audit(text, text, uuid, uuid, jsonb) from anon, authenticated;

revoke execute on function public.supprimer_amende(uuid, text) from anon;
revoke execute on function public.supprimer_paiement(uuid, text) from anon;
revoke execute on function public.cloturer_caisse(uuid) from anon;
revoke execute on function public.reouvrir_caisse(uuid) from anon;
