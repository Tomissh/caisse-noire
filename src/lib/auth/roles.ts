// Types et utilitaires pour les rôles applicatifs.

export type AdminRole = "createur" | "admin" | "super_admin";

export type CaisseAccess = {
  caisse_id: string;
  nom: string;
  code: string;
  cloturee_at: string | null;
  role: AdminRole;
};

/** Claims du JWT custom émis par l'Edge Function login-membre. */
export type MembreClaims = {
  app_role: "membre";
  caisse_id: string;
  membre_id: string;
  /** Unix seconds */
  exp: number;
  iat: number;
  sub: string;
  aud: "authenticated";
  role: "authenticated";
};

/** État initial de l'AdminAuthContext, hydraté par le layout (admin) (SSR). */
export type AdminInitialState = {
  userId: string;
  email: string | null;
  isSuperAdmin: boolean;
  caissesAdmin: CaisseAccess[];
};
