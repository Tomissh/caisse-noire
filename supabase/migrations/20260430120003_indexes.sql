-- Index pour les requêtes fréquentes
-- Caisse Noire v2 — Phase 2

-- caisses : lookup par créateur
create index caisses_createur_id_idx on public.caisses (createur_id);

-- admins_caisse : lookup par user (pour résoudre "mes caisses")
create index admins_caisse_user_id_idx on public.admins_caisse (user_id);

-- membres : par caisse, et par caisse + actif (filtre liste)
create index membres_caisse_id_idx        on public.membres (caisse_id);
create index membres_caisse_actif_idx     on public.membres (caisse_id) where actif;

-- motifs_amende : par caisse + actif
create index motifs_amende_caisse_idx     on public.motifs_amende (caisse_id);
create index motifs_amende_caisse_actif_idx
  on public.motifs_amende (caisse_id) where actif;

-- amendes : listes par caisse, par membre, partial sur non-supprimées
create index amendes_caisse_id_idx        on public.amendes (caisse_id);
create index amendes_membre_id_idx        on public.amendes (membre_id);
create index amendes_caisse_active_idx
  on public.amendes (caisse_id, created_at desc)
  where supprimee_at is null;
create index amendes_membre_active_idx
  on public.amendes (membre_id, created_at desc)
  where supprimee_at is null;

-- paiements : idem amendes
create index paiements_caisse_id_idx      on public.paiements (caisse_id);
create index paiements_membre_id_idx      on public.paiements (membre_id);
create index paiements_caisse_active_idx
  on public.paiements (caisse_id, created_at desc)
  where supprimee_at is null;
create index paiements_membre_active_idx
  on public.paiements (membre_id, created_at desc)
  where supprimee_at is null;

-- retraits : par caisse trié par date
create index retraits_caisse_created_idx
  on public.retraits (caisse_id, created_at desc);

-- audit_log : par caisse trié par date, par acteur
create index audit_log_caisse_created_idx
  on public.audit_log (caisse_id, created_at desc);
create index audit_log_acteur_user_idx
  on public.audit_log (acteur_user_id) where acteur_user_id is not null;
