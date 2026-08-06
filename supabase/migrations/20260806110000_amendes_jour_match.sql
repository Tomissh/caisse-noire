-- Amendes "jour de match" : montant doublé automatiquement.
--
-- Le flag est porté par la déclaration d'amende elle-même (colonne sur
-- `amendes`), pas par le motif du catalogue : un même motif peut être
-- déclaré un jour de match ou non selon les circonstances.
--
-- Le doublement du montant est appliqué en base (trigger BEFORE INSERT),
-- pas côté frontend (règle CDC 8.1 #1) : le formulaire n'affiche qu'un
-- aperçu du montant final, la valeur envoyée au serveur reste le montant
-- de base et c'est le trigger qui applique le ×2.

alter table public.amendes
  add column jour_match boolean not null default false;

comment on column public.amendes.jour_match is
  'true = amende déclarée un jour de match, montant doublé automatiquement à l''insertion (voir tg_amendes_appliquer_jour_match).';

create or replace function public.tg_amendes_appliquer_jour_match()
returns trigger
language plpgsql
as $$
begin
  if new.jour_match then
    new.montant_centimes := new.montant_centimes * 2;
  end if;
  return new;
end;
$$;

create trigger amendes_appliquer_jour_match
  before insert on public.amendes
  for each row execute function public.tg_amendes_appliquer_jour_match();
