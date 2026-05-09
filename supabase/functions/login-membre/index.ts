// Edge Function : login-membre
//
// Vérifie (code_caisse, prenom, nom, mot_de_passe) → renvoie un JWT custom
// signé avec le SUPABASE_JWT_SECRET portant les claims :
//   { aud: 'authenticated', role: 'authenticated', sub: <membre_id>,
//     app_role: 'membre', caisse_id, membre_id, exp }
//
// Le JWT est stocké côté client en sessionStorage et passé en
// Authorization: Bearer <jwt> sur les requêtes Supabase. Les helpers RLS
// is_membre_of(caisse_id) et current_membre_id() lisent ces claims.

import { createClient } from "jsr:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12 h

interface LoginPayload {
  code_caisse: string;
  prenom: string;
  nom: string;
  mot_de_passe: string;
}

function badRequest(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
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
    return badRequest("Méthode non autorisée", 405);
  }

  let payload: LoginPayload;
  try {
    payload = await req.json();
  } catch {
    return badRequest("Corps de requête invalide");
  }

  const code = payload.code_caisse?.trim().toUpperCase();
  const prenom = payload.prenom?.trim();
  const nom = payload.nom?.trim();
  const mdp = payload.mot_de_passe;

  if (!code || !prenom || !nom || !mdp) {
    return badRequest("Champs requis : code_caisse, prenom, nom, mot_de_passe");
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET")!;

  if (!SUPABASE_URL || !SERVICE_ROLE || !JWT_SECRET) {
    return badRequest("Configuration serveur incomplète", 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: caisse, error: errCaisse } = await admin
    .from("caisses")
    .select("id, cloturee_at")
    .eq("code", code)
    .maybeSingle();

  if (errCaisse) return badRequest("Erreur serveur", 500);
  if (!caisse) return badRequest("Identifiants invalides", 401);
  if (caisse.cloturee_at) return badRequest("Cette caisse est clôturée", 403);

  const { data: membre, error: errMembre } = await admin
    .from("membres")
    .select("id, password_hash, actif")
    .eq("caisse_id", caisse.id)
    .ilike("prenom", prenom)
    .ilike("nom", nom)
    .maybeSingle();

  if (errMembre) return badRequest("Erreur serveur", 500);
  if (!membre) return badRequest("Identifiants invalides", 401);
  if (!membre.actif) return badRequest("Membre désactivé", 403);
  if (!membre.password_hash) {
    return badRequest("Mot de passe non défini, contactez un administrateur", 403);
  }

  const ok = await bcrypt.compare(mdp, membre.password_hash);
  if (!ok) return badRequest("Identifiants invalides", 401);

  const key = await importJwtKey(JWT_SECRET);
  const jwt = await create(
    { alg: "HS256", typ: "JWT" },
    {
      iss: "supabase",
      aud: "authenticated",
      role: "authenticated",
      sub: membre.id,
      app_role: "membre",
      caisse_id: caisse.id,
      membre_id: membre.id,
      iat: getNumericDate(0),
      exp: getNumericDate(SESSION_DURATION_SECONDS),
    },
    key,
  );

  return new Response(
    JSON.stringify({
      access_token: jwt,
      expires_in: SESSION_DURATION_SECONDS,
      caisse_id: caisse.id,
      membre_id: membre.id,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
