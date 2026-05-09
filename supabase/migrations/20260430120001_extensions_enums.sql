-- Extensions et types enum
-- Caisse Noire v2 — Phase 2

create extension if not exists "pgcrypto" with schema public;
create extension if not exists "citext"   with schema public;

create type public.moyen_paiement as enum ('especes', 'virement', 'autre');
