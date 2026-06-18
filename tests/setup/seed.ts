// Seed déterministe pour les tests E2E.
// Prérequis :
//   - `supabase start` lancé (Docker)
//   - `supabase db reset` exécuté avant (DB propre + migrations appliquées)
//   - .env.test.local chargé (cf. tests/setup/env.ts)
//
// Crée :
//   - 1 super-admin Auth + ligne super_admins
//   - 1 admin Auth normal (sera aussi créateur de la caisse)
//   - 1 caisse "Caisse E2E" code E2ETEST1
//   - 3 motifs
//   - 2 membres avec password_hash bcrypt

import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { FIXTURES, TEST_ENV } from "./env";

async function main() {
  const admin = createClient(TEST_ENV.SUPABASE_URL, TEST_ENV.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  console.log("→ Création super-admin Auth...");
  const { data: superUser, error: errSuper } = await admin.auth.admin.createUser({
    email: FIXTURES.superAdmin.email,
    password: FIXTURES.superAdmin.password,
    email_confirm: true,
  });
  if (errSuper) throw new Error(`createUser super: ${errSuper.message}`);
  const superUserId = superUser.user!.id;

  const { error: errSuperRow } = await admin
    .from("super_admins")
    .insert({ user_id: superUserId });
  if (errSuperRow) throw new Error(`super_admins insert: ${errSuperRow.message}`);

  console.log("→ Création admin Auth (créateur caisse)...");
  const { data: adminUser, error: errAdmin } = await admin.auth.admin.createUser({
    email: FIXTURES.admin.email,
    password: FIXTURES.admin.password,
    email_confirm: true,
  });
  if (errAdmin) throw new Error(`createUser admin: ${errAdmin.message}`);
  const adminUserId = adminUser.user!.id;

  console.log("→ Création caisse...");
  const { data: caisse, error: errCaisse } = await admin
    .from("caisses")
    .insert({
      code: FIXTURES.caisse.code,
      nom: FIXTURES.caisse.nom,
      description: FIXTURES.caisse.description,
      createur_id: adminUserId,
    })
    .select("id")
    .single();
  if (errCaisse) throw new Error(`caisses insert: ${errCaisse.message}`);
  const caisseId = caisse.id;

  await admin.from("admins_caisse").insert({ caisse_id: caisseId, user_id: adminUserId });

  console.log("→ Création motifs...");
  for (const m of FIXTURES.motifs) {
    const { error } = await admin.from("motifs_amende").insert({
      caisse_id: caisseId,
      libelle: m.libelle,
      montant_centimes: m.montantCentimes,
      montant_variable: m.montantVariable ?? false,
    });
    if (error) throw new Error(`motifs insert: ${error.message}`);
  }

  console.log("→ Création membres + password_hash bcrypt...");
  for (const m of FIXTURES.membres) {
    const hash = await bcrypt.hash(m.password, 12);
    const { error } = await admin.from("membres").insert({
      caisse_id: caisseId,
      prenom: m.prenom,
      nom: m.nom,
      password_hash: hash,
    });
    if (error) throw new Error(`membres insert: ${error.message}`);
  }

  console.log("✓ Seed terminé.");
  console.log(`  caisse_id    = ${caisseId}`);
  console.log(`  admin_email  = ${FIXTURES.admin.email}`);
  console.log(`  super_email  = ${FIXTURES.superAdmin.email}`);
  console.log(`  code_caisse  = ${FIXTURES.caisse.code}`);
}

main().catch((err) => {
  console.error("✗ Seed échoué :", err);
  process.exit(1);
});
