-- Déplace le contrôle de la réduction "-50% étudiant" du moment de la
-- saisie d'une amende vers le motif du catalogue lui-même.
--
-- Avant (20260910150000) : l'admin cochait "-50% étudiant" ligne par ligne
-- à chaque déclaration d'amende. Trop facile à oublier / à cocher par
-- erreur, et à vérifier après coup.
--
-- Maintenant : le flag se pose une fois pour toutes sur le motif (création
-- ou modification). Toute amende déclarée à partir d'un motif marqué
-- hérite automatiquement de la réduction, sans rien à cocher à la saisie.
-- Une amende en "saisie libre" (motif_id = null) n'est donc plus jamais
-- éligible — il n'y a plus de motif pour porter le flag.
--
-- `amendes.reduction_etudiant` (ajoutée en 20260910150000) reste la colonne
-- lue par v_membre_situation et recap_mensuel_simple — sa logique de calcul
-- ne change pas. Seule sa source change : elle n'est plus envoyée par le
-- client (retiré du formulaire de saisie), elle est recopiée depuis le
-- motif par un trigger BEFORE INSERT, sur le même principe que
-- tg_amendes_appliquer_jour_match (20260806110000) mais qui ÉCRASE
-- systématiquement la valeur plutôt que de la doubler conditionnellement,
-- pour qu'un insert direct en base (bypass du formulaire) ne puisse pas
-- positionner ce flag autrement qu'en cochant le motif.

alter table public.motifs_amende
  add column reduction_etudiant boolean not null default false;

comment on column public.motifs_amende.reduction_etudiant is
  '-50% étudiant : toute amende déclarée avec ce motif hérite automatiquement de la réduction (via le trigger amendes_appliquer_reduction_etudiant_motif), sans case à cocher à la saisie.';

create or replace function public.tg_amendes_appliquer_reduction_etudiant_motif()
returns trigger
language plpgsql
as $$
begin
  new.reduction_etudiant := coalesce(
    (select m.reduction_etudiant from public.motifs_amende m where m.id = new.motif_id),
    false
  );
  return new;
end;
$$;

create trigger amendes_appliquer_reduction_etudiant_motif
  before insert on public.amendes
  for each row execute function public.tg_amendes_appliquer_reduction_etudiant_motif();

-- Cohérence avec le durcissement des grants sur les fonctions tg_* (cf.
-- 20260807130000_durcissement_grants_anon_authenticated.sql), appliqué ici
-- dès la création puisque cette fonction est postérieure à cette migration.
revoke execute on function public.tg_amendes_appliquer_reduction_etudiant_motif()
  from anon, authenticated;
