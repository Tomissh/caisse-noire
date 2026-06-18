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
  // Solde affiché (peut être 0 ou négatif selon ordre des tests)
  await expect(page.getByText(/solde/i).first()).toBeVisible();
});
