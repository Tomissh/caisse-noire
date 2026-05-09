-- Tables et contraintes
-- Caisse Noire v2 — Phase 2
--
-- Conventions :
--   - Montants stockés en centimes (integer). CHECK % 100 = 0 partout pour
--     interdire la saisie en centimes (UI en euros entiers uniquement).
--   - caisse_id dénormalisé sur les tables enfants pour accélérer la RLS.
--   - Soft-delete sur amendes/paiements : (supprimee_at, supprimee_par_user_id,
--     motif_suppression). Triplet cohérent garanti par CHECK.
--   - retraits immuables : pas de UPDATE/DELETE (verrouillé via trigger en 006).

------------------------------------------------------------------------------
-- super_admins : root global, peut réouvrir une caisse clôturée
------------------------------------------------------------------------------
create table public.super_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

------------------------------------------------------------------------------
-- caisses
------------------------------------------------------------------------------
create table public.caisses (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique
                 check (code ~ '^[A-Z0-9]{6,12}$'),
  nom          text not null
                 check (length(trim(nom)) between 1 and 80),
  description  text
                 check (description is null or length(description) <= 500),
  createur_id  uuid not null references auth.users(id) on delete restrict,
  cloturee_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

------------------------------------------------------------------------------
-- admins_caisse : admins additionnels (le créateur n'a pas besoin d'y figurer)
------------------------------------------------------------------------------
create table public.admins_caisse (
  caisse_id  uuid not null references public.caisses(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (caisse_id, user_id)
);

------------------------------------------------------------------------------
-- membres
------------------------------------------------------------------------------
create table public.membres (
  id            uuid primary key default gen_random_uuid(),
  caisse_id     uuid not null references public.caisses(id) on delete cascade,
  prenom        text not null check (length(trim(prenom)) between 1 and 60),
  nom           text not null check (length(trim(nom)) between 1 and 60),
  password_hash text,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index membres_caisse_identite_unique
  on public.membres (caisse_id, lower(prenom), lower(nom));

------------------------------------------------------------------------------
-- motifs_amende : catalogue des motifs par caisse
------------------------------------------------------------------------------
create table public.motifs_amende (
  id               uuid primary key default gen_random_uuid(),
  caisse_id        uuid not null references public.caisses(id) on delete cascade,
  libelle          text not null check (length(trim(libelle)) between 1 and 120),
  montant_centimes integer not null
                     check (montant_centimes > 0)
                     check (montant_centimes % 100 = 0),
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (caisse_id, libelle)
);

------------------------------------------------------------------------------
-- amendes : déclarations (1 amende = 1 ligne)
--   Déclarées uniquement par admin/créateur (declaree_par_user_id NOT NULL).
--   Soft-delete avec motif obligatoire ≥ 5 caractères.
------------------------------------------------------------------------------
create table public.amendes (
  id                     uuid primary key default gen_random_uuid(),
  caisse_id              uuid not null references public.caisses(id) on delete cascade,
  membre_id              uuid not null references public.membres(id) on delete restrict,
  motif_id               uuid     references public.motifs_amende(id) on delete set null,
  libelle                text not null check (length(trim(libelle)) between 1 and 120),
  montant_centimes       integer not null
                            check (montant_centimes > 0)
                            check (montant_centimes % 100 = 0),
  declaree_par_user_id   uuid not null references auth.users(id) on delete restrict,
  supprimee_at           timestamptz,
  supprimee_par_user_id  uuid references auth.users(id) on delete set null,
  motif_suppression      text,
  created_at             timestamptz not null default now(),

  constraint amendes_soft_delete_coherent check (
    (supprimee_at is null
       and supprimee_par_user_id is null
       and motif_suppression is null)
    or
    (supprimee_at is not null
       and supprimee_par_user_id is not null
       and motif_suppression is not null
       and length(trim(motif_suppression)) >= 5)
  )
);

------------------------------------------------------------------------------
-- paiements : crédits déposés par un membre (modèle compte-courant).
--   Plus de FK vers une amende précise : un paiement = un dépôt.
--   Solde membre = SUM(paiements actifs) - SUM(amendes actives).
--   Soft-delete idem amendes.
------------------------------------------------------------------------------
create table public.paiements (
  id                       uuid primary key default gen_random_uuid(),
  caisse_id                uuid not null references public.caisses(id) on delete cascade,
  membre_id                uuid not null references public.membres(id) on delete restrict,
  montant_centimes         integer not null
                              check (montant_centimes > 0)
                              check (montant_centimes % 100 = 0),
  moyen                    public.moyen_paiement not null,
  enregistre_par_user_id   uuid not null references auth.users(id) on delete restrict,
  supprimee_at             timestamptz,
  supprimee_par_user_id    uuid references auth.users(id) on delete set null,
  motif_suppression        text,
  created_at               timestamptz not null default now(),

  constraint paiements_soft_delete_coherent check (
    (supprimee_at is null
       and supprimee_par_user_id is null
       and motif_suppression is null)
    or
    (supprimee_at is not null
       and supprimee_par_user_id is not null
       and motif_suppression is not null
       and length(trim(motif_suppression)) >= 5)
  )
);

------------------------------------------------------------------------------
-- retraits : sortie d'argent. IMMUABLES (UPDATE/DELETE bloqués par trigger).
--   Correction = INSERT d'un retrait avec montant négatif.
------------------------------------------------------------------------------
create table public.retraits (
  id                      uuid primary key default gen_random_uuid(),
  caisse_id               uuid not null references public.caisses(id) on delete restrict,
  libelle                 text not null check (length(trim(libelle)) between 1 and 200),
  montant_centimes        integer not null
                             check (montant_centimes <> 0)
                             check (montant_centimes % 100 = 0),
  enregistre_par_user_id  uuid not null references auth.users(id) on delete restrict,
  created_at              timestamptz not null default now()
);

------------------------------------------------------------------------------
-- audit_log : trace des actions sensibles. INSERT seulement (RLS).
------------------------------------------------------------------------------
create table public.audit_log (
  id                  uuid primary key default gen_random_uuid(),
  caisse_id           uuid references public.caisses(id) on delete set null,
  action              text not null
                        check (length(action) between 1 and 80),
  entite_type         text,
  entite_id           uuid,
  acteur_user_id      uuid references auth.users(id) on delete set null,
  acteur_membre_id    uuid references public.membres(id) on delete set null,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);
