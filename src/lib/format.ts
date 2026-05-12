// Helpers de conversion / affichage des montants.
//
// Convention projet (cf. Phase 2) :
//   - stockage en centimes (integer), CHECK `% 100 = 0` partout
//   - saisie UI en euros entiers uniquement (pas de centimes)
//   - affichage en euros, signe explicite pour les soldes

/** 5 → 500 (centimes). Round pour absorber les flottants. */
export function eurosToCentimes(euros: number): number {
  return Math.round(euros * 100);
}

/** 500 → 5 (euros). */
export function centimesToEuros(centimes: number): number {
  return centimes / 100;
}

/** Affichage neutre : "5,00 €" (sans signe). */
export function formatEuros(centimes: number): string {
  const e = centimes / 100;
  return `${e.toFixed(2).replace(".", ",")} €`;
}

/** Affichage signé pour les soldes : "+5,00 €" ou "-15,00 €" ou "0,00 €". */
export function formatSolde(centimes: number): string {
  if (centimes === 0) return "0,00 €";
  const sign = centimes > 0 ? "+" : "−";
  const abs = Math.abs(centimes) / 100;
  return `${sign}${abs.toFixed(2).replace(".", ",")} €`;
}
