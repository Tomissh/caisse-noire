-- Statut "étudiant" sur un membre : les étudiants ne paient que la moitié
-- (arrondie à l'euro supérieur) du montant de leurs amendes à la fin du
-- mois. C'est purement informatif au moment de la saisie d'un paiement
-- (src/app/(admin)/.../ecritures/paiement/new/_form.tsx, calcul fait côté
-- client à partir de v_membre_situation) : aucune réduction n'est appliquée
-- ni mémorisée en base. Le solde réel (v_membre_situation), le
-- récapitulatif mensuel (recap_mensuel_simple) et le PDF de clôture restent
-- calculés sur le montant plein des amendes déclarées.

alter table public.membres
  add column etudiant boolean not null default false;

comment on column public.membres.etudiant is
  'Membre étudiant : ne paie que la moitié (arrondie à l''euro supérieur) du montant de ses amendes. Purement informatif côté saisie de paiement — n''affecte ni v_membre_situation ni le récapitulatif mensuel.';
