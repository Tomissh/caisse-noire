-- Activation RLS et policies par table
-- Caisse Noire v2 — Phase 2
--
-- Logique d'autorisation :
--   - super_admin : tout, partout (y compris caisse clôturée, réouverture)
--   - créateur    : tout sur sa caisse (clôture, suppression caisse, ...)
--   - admin       : écriture sur sa caisse, sauf clôture/réouverture/suppression
--   - membre      : lecture sur sa caisse (via JWT custom)
--
--   Caisse clôturée → écritures bloquées sauf super_admin.
--   retraits → INSERT only (UPDATE/DELETE bloqués par trigger en 006).
--   amendes/paiements → DELETE bloqué (passer par soft-delete UPDATE).

------------------------------------------------------------------------------
-- super_admins : aucune écriture publique. Lecture par soi-même uniquement.
------------------------------------------------------------------------------
alter table public.super_admins enable row level security;

create policy super_admins_select_self
  on public.super_admins for select
  to authenticated
  using (user_id = auth.uid());

------------------------------------------------------------------------------
-- caisses
------------------------------------------------------------------------------
alter table public.caisses enable row level security;

create policy caisses_select
  on public.caisses for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(id)
    or public.is_membre_of(id)
  );

create policy caisses_insert
  on public.caisses for insert
  to authenticated
  with check (createur_id = auth.uid());

-- UPDATE : super_admin OU admin/créateur. Le contrôle des colonnes modifiables
-- (cloturee_at réservé créateur+super_admin) est fait par trigger en 006.
create policy caisses_update
  on public.caisses for update
  to authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(id)
  )
  with check (
    public.is_super_admin()
    or public.is_admin_of(id)
  );

create policy caisses_delete
  on public.caisses for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.is_createur_of(id)
  );

------------------------------------------------------------------------------
-- admins_caisse
------------------------------------------------------------------------------
alter table public.admins_caisse enable row level security;

create policy admins_caisse_select
  on public.admins_caisse for select
  to authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
  );

create policy admins_caisse_insert
  on public.admins_caisse for insert
  to authenticated
  with check (
    public.is_super_admin()
    or public.is_createur_of(caisse_id)
  );

create policy admins_caisse_delete
  on public.admins_caisse for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.is_createur_of(caisse_id)
  );

------------------------------------------------------------------------------
-- membres
--   - lecture : admin/créateur, super_admin, et le membre lui-même
--   - écriture : admin/créateur sur caisse ouverte, super_admin sans limite
--   - DELETE : créateur uniquement
--   - le password_hash est mis à jour côté serveur via Edge Function
--     set-password-membre (service_role bypass la RLS, donc OK).
------------------------------------------------------------------------------
alter table public.membres enable row level security;

create policy membres_select
  on public.membres for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or public.is_membre_of(caisse_id)
  );

create policy membres_insert
  on public.membres for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

create policy membres_update
  on public.membres for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

create policy membres_delete
  on public.membres for delete
  to authenticated
  using (
    public.is_super_admin()
    or public.is_createur_of(caisse_id)
  );

------------------------------------------------------------------------------
-- motifs_amende
------------------------------------------------------------------------------
alter table public.motifs_amende enable row level security;

create policy motifs_amende_select
  on public.motifs_amende for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or public.is_membre_of(caisse_id)
  );

create policy motifs_amende_insert
  on public.motifs_amende for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

create policy motifs_amende_update
  on public.motifs_amende for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

create policy motifs_amende_delete
  on public.motifs_amende for delete
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

------------------------------------------------------------------------------
-- amendes
--   DELETE bloqué pour tous (passer par UPDATE soft-delete).
--   Membres voient seulement les non-supprimées de leur caisse.
------------------------------------------------------------------------------
alter table public.amendes enable row level security;

create policy amendes_select
  on public.amendes for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or (public.is_membre_of(caisse_id) and supprimee_at is null)
  );

create policy amendes_insert
  on public.amendes for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_admin_of(caisse_id)
      and public.caisse_est_ouverte(caisse_id)
      and declaree_par_user_id = auth.uid()
    )
  );

create policy amendes_update
  on public.amendes for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

------------------------------------------------------------------------------
-- paiements (mêmes règles qu'amendes)
------------------------------------------------------------------------------
alter table public.paiements enable row level security;

create policy paiements_select
  on public.paiements for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or (public.is_membre_of(caisse_id) and supprimee_at is null)
  );

create policy paiements_insert
  on public.paiements for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_admin_of(caisse_id)
      and public.caisse_est_ouverte(caisse_id)
      and enregistre_par_user_id = auth.uid()
    )
  );

create policy paiements_update
  on public.paiements for update
  to authenticated
  using (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  )
  with check (
    public.is_super_admin()
    or (public.is_admin_of(caisse_id) and public.caisse_est_ouverte(caisse_id))
  );

------------------------------------------------------------------------------
-- retraits : INSERT only. UPDATE/DELETE bloqués par trigger en 006.
--   Lecture autorisée aux membres : transparence du compte.
------------------------------------------------------------------------------
alter table public.retraits enable row level security;

create policy retraits_select
  on public.retraits for select
  to anon, authenticated
  using (
    public.is_super_admin()
    or public.is_admin_of(caisse_id)
    or public.is_membre_of(caisse_id)
  );

create policy retraits_insert
  on public.retraits for insert
  to authenticated
  with check (
    public.is_super_admin()
    or (
      public.is_admin_of(caisse_id)
      and public.caisse_est_ouverte(caisse_id)
      and enregistre_par_user_id = auth.uid()
    )
  );

------------------------------------------------------------------------------
-- audit_log : SELECT admin/créateur+super_admin, INSERT via triggers DEFINER
------------------------------------------------------------------------------
alter table public.audit_log enable row level security;

create policy audit_log_select
  on public.audit_log for select
  to authenticated
  using (
    public.is_super_admin()
    or (caisse_id is not null and public.is_admin_of(caisse_id))
  );

-- Pas de policy INSERT publique : les triggers SECURITY DEFINER bypassent.
