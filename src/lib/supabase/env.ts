// Variables d'environnement Supabase — typées et validées au chargement.

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// Disponible uniquement côté serveur. Ne JAMAIS importer depuis un composant
// client. admin.ts vérifie ça via "server-only".
export function getServiceRoleKey(): string {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
