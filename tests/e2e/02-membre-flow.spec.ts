// Parcours membre : login via code + prénom + nom + mot de passe → voit son tableau de bord.

import { test, expect } from "@playwright/test";
import { FIXTURES } from "../setup/env";

// Skippé en local CLI Supabase 2.96 : SUPABASE_JWT_SECRET n'est pas exposable à
// Deno.env.get dans l'Edge Function login-membre (allowlist du runtime).
// À relancer une fois la CLI mise à jour vers ≥ 2.107 ou via fix upstream Supabase.
test.skip("membre se connecte avec son code de caisse et voit son solde", async ({ page }) => {
  const alice = FIXTURES.membres[0]!;

  await page.goto("/membre/login");
  await page.getByLabel(/code/i).fill(FIXTURES.caisse.code);
  await page.getByLabel(/prénom/i).fill(alice.prenom);
  await page.getByLabel(/^nom/i).fill(alice.nom);
  await page.getByLabel(/mot de passe/i).fill(alice.password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  await expect(page).toHaveURL(/\/membre/);
  // Le dashboard affiche "Bienvenue, Alice" + "Mon solde" + montant en €
  await expect(page.getByRole("heading", { name: /Bienvenue/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/Mon solde/i)).toBeVisible();
  await expect(page.getByText(/€/).first()).toBeVisible();
});
