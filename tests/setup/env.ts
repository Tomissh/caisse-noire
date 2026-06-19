// Variables d'env nécessaires aux scripts de seed / tests E2E.
// Pointent par défaut sur la stack Supabase locale (supabase start).
// En CI on récupère les vraies clés via `supabase status --output env` puis on les exporte.

import { config } from "dotenv";
import path from "node:path";

// Charge .env.test.local en priorité (généré depuis `supabase status -o env`),
// puis .env.local en fallback (vars d'app prod — anti-pattern pour les tests
// mais utile si on lance le seed contre la prod en dépannage manuel).
config({ path: path.resolve(process.cwd(), ".env.test.local") });
config({ path: path.resolve(process.cwd(), ".env.local") });

function required(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(
    `Variable d'environnement manquante : ${name}. Lance d'abord :\n` +
      `  supabase status --output env > .env.test.local\n` +
      `puis exporte-la (cf. scripts/load-test-env.sh).`,
  );
}

export const TEST_ENV = {
  SUPABASE_URL: required("SUPABASE_URL", "http://127.0.0.1:54321"),
  SUPABASE_ANON_KEY: required("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_JWT_SECRET: required(
    "SUPABASE_JWT_SECRET",
    "super-secret-jwt-token-with-at-least-32-characters-long",
  ),
};

// Comptes fixtures déterministes (utilisés par le seed ET les tests).
export const FIXTURES = {
  admin: {
    email: "e2e-admin@test.local",
    password: "TestAdmin1234!",
  },
  superAdmin: {
    email: "e2e-super@test.local",
    password: "TestSuper1234!",
  },
  caisse: {
    nom: "Caisse E2E",
    code: "E2ETEST1",
    description: "Caisse de test E2E — recréée à chaque seed",
  },
  membres: [
    { prenom: "Alice", nom: "Dupont", password: "alice1234" },
    { prenom: "Bob", nom: "Martin", password: "bob1234" },
  ],
  motifs: [
    { libelle: "Retard à l'entraînement", montantCentimes: 500 },
    { libelle: "Oubli d'équipement", montantCentimes: 200 },
    { libelle: "Motif libre", montantCentimes: 1000, montantVariable: true },
  ],
};
