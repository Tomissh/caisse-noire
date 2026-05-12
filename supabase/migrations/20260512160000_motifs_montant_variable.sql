-- Ajout du flag `montant_variable` sur motifs_amende
-- Phase 4.B
--
-- Sémantique :
--   - false (défaut) : motif catalogué à montant fixe. À la saisie d'une
--     amende, libellé et montant sont pré-remplis et verrouillés (readonly).
--   - true            : motif "barème indicatif". À la saisie, libellé et
--     montant sont pré-remplis mais éditables par l'admin.
--   - Saisie libre   : motif_id = null, libellé et montant saisis à la volée.

alter table public.motifs_amende
  add column montant_variable boolean not null default false;

comment on column public.motifs_amende.montant_variable is
  'true = libellé/montant modifiables à la saisie de l''amende ; false = verrouillés sur les valeurs du catalogue.';
