// Edge Function : set-password-membre
//
// Définit ou change le mot de passe d'un membre. Deux modes d'appel :
//
// 1. Authentifié comme admin/créateur de la caisse (Authorization: Bearer
//    <user JWT>) → peut définir le mot de passe de n'importe quel membre de
//    la caisse (sert pour onboarding initial ou reset).
//
// 2. Authentifié comme membre via JWT custom (app_role='membre') → ne peut
//    changer que son propre mot de passe ET doit fournir l'ancien.
//
// Hashage : bcrypt cost 12.

import { createClient } from "jsr:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const BCRYPT_COST = 12;
const PASSWORD_MIN_LENGTH = 6;

interface SetPasswordPayload {
  membre_id: string;
  nouveau_mot_de_passe: string;
  ancien_mot_de_passe?: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function importJwtKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Méthode non autorisée" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ error: "Authentification requise" }, 401);

  let payload: SetPasswordPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Corps de requête invalide" }, 400);
  }

  const { membre_id, nouveau_mot_de_passe, ancien_mot_de_passe } = payload;
  if (!membre_id || !nouveau_mot_de_passe) {
    return jsonResponse(
      { error: "Champs requis : membre_id, nouveau_mot_de_passe" },
      400,
    );
  }
  if (nouveau_mot_de_passe.length < PASSWORD_MIN_LENGTH) {
    return jsonResponse(
      { error: `Mot de passe trop court (min ${PASSWORD_MIN_LENGTH} caractères)` },
      400,
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const JWT_SECRET = Deno.env.get("MEMBRE_JWT_SECRET")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  if (!SUPABASE_URL || !SERVICE_ROLE || !JWT_SECRET || !ANON_KEY) {
    return jsonResponse({ error: "Configuration serveur incomplète" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: membre, error: errMembre } = await admin
    .from("membres")
    .select("id, caisse_id, password_hash, actif")
    .eq("id", membre_id)
    .maybeSingle();

  if (errMembre) return jsonResponse({ error: "Erreur serveur" }, 500);
  if (!membre) return jsonResponse({ error: "Membre introuvable" }, 404);
  if (!membre.actif) return jsonResponse({ error: "Membre désactivé" }, 403);

  // Vérifier l'autorisation : soit admin/créateur de la caisse, soit le membre
  // lui-même via JWT custom.
  let allowed = false;
  let isMembreSelf = false;

  // Tente d'abord en tant qu'admin/créateur via Supabase Auth
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData } = await userClient.auth.getUser();
  if (userData?.user) {
    const userId = userData.user.id;
    // is_admin_of() lit auth.uid() ; en service_role auth.uid() est null,
    // donc on résout l'autorisation via des requêtes directes.
    const { data: caisse } = await admin
      .from("caisses")
      .select("createur_id")
      .eq("id", membre.caisse_id)
      .maybeSingle();
    const isCreateur = caisse?.createur_id === userId;
    const { data: adminRow } = await admin
      .from("admins_caisse")
      .select("user_id")
      .eq("caisse_id", membre.caisse_id)
      .eq("user_id", userId)
      .maybeSingle();
    const { data: superAdmin } = await admin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (isCreateur || adminRow || superAdmin) allowed = true;
  }

  // Sinon, peut-être un JWT membre custom
  if (!allowed) {
    try {
      const key = await importJwtKey(JWT_SECRET);
      const claims = await verify(token, key);
      const claimsObj = claims as Record<string, unknown>;
      if (
        claimsObj.app_role === "membre" &&
        claimsObj.membre_id === membre_id
      ) {
        if (!ancien_mot_de_passe) {
          return jsonResponse(
            { error: "Ancien mot de passe requis" },
            400,
          );
        }
        if (!membre.password_hash) {
          return jsonResponse(
            { error: "Aucun mot de passe à vérifier" },
            400,
          );
        }
        const ok = await bcrypt.compare(
          ancien_mot_de_passe,
          membre.password_hash,
        );
        if (!ok) {
          return jsonResponse({ error: "Ancien mot de passe incorrect" }, 401);
        }
        allowed = true;
        isMembreSelf = true;
      }
    } catch {
      // JWT invalide → on retombe sur "non autorisé"
    }
  }

  if (!allowed) return jsonResponse({ error: "Non autorisé" }, 403);

  const newHash = await bcrypt.hash(nouveau_mot_de_passe, BCRYPT_COST);

  const { error: errUpdate } = await admin
    .from("membres")
    .update({ password_hash: newHash })
    .eq("id", membre_id);

  if (errUpdate) return jsonResponse({ error: "Erreur lors de la mise à jour" }, 500);

  // Trace audit_log via RPC SECURITY DEFINER (à défaut, INSERT direct)
  await admin.from("audit_log").insert({
    caisse_id: membre.caisse_id,
    action: "membre.set_password",
    entite_type: "membres",
    entite_id: membre.id,
    acteur_user_id: userData?.user?.id ?? null,
    acteur_membre_id: isMembreSelf ? membre.id : null,
    payload: { self: isMembreSelf },
  });

  return jsonResponse({ ok: true });
});
