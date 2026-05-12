// Génération d'un code de caisse aléatoire conforme à la contrainte
// `code ~ '^[A-Z0-9]{6,12}$'` (cf. migration tables.sql).
//
// Longueur par défaut 8 → ~2.8 × 10^12 combinaisons, largement suffisant à
// l'échelle privée du projet. La fonction est sûre cryptographiquement
// (crypto.getRandomValues), avec fallback Math.random.

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateCaisseCode(length = 8): string {
  if (length < 6 || length > 12) {
    throw new Error("Code length must be between 6 and 12");
  }
  const out: string[] = [];
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    for (let i = 0; i < length; i++) {
      out.push(ALPHA[(buf[i] ?? 0) % ALPHA.length]!);
    }
  } else {
    for (let i = 0; i < length; i++) {
      out.push(ALPHA[Math.floor(Math.random() * ALPHA.length)]!);
    }
  }
  return out.join("");
}

/** Génère un mot de passe lisible (24 chars, alphanum sans confusion). */
export function generatePassword(length = 16): string {
  const charset = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(length);
    crypto.getRandomValues(buf);
    let out = "";
    for (let i = 0; i < length; i++) out += charset[(buf[i] ?? 0) % charset.length]!;
    return out;
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[Math.floor(Math.random() * charset.length)]!;
  }
  return out;
}
