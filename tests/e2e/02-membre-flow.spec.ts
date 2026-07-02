// Parcours membre : login via code + prénom + nom + mot de passe → voit son tableau de bord.

import { test, expect } from "@playwright/test";
import { FIXTURES } from "../setup/env";

test("membre se connecte avec son code de caisse et voit son solde", async ({ page }) => {
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
