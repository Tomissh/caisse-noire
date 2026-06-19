// Parcours admin : login → tableau de bord → enregistrer une amende sur Alice.
// Pré-requis : seed.ts exécuté (caisse "Caisse E2E", motif "Retard à l'entraînement", Alice Dupont).

import { test, expect } from "@playwright/test";
import { FIXTURES } from "../setup/env";

test("admin se connecte, ouvre sa caisse, déclare une amende", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(FIXTURES.admin.email);
  await page.getByLabel(/mot de passe/i).fill(FIXTURES.admin.password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByText(FIXTURES.caisse.nom)).toBeVisible();

  // Ouvre la caisse
  await page.getByRole("link", { name: new RegExp(FIXTURES.caisse.nom, "i") }).click();
  await expect(page).toHaveURL(/\/admin\/caisses\//);

  // Va sur écritures → nouvelle amende
  await page.getByRole("link", { name: /écritures/i }).click();
  await page.getByRole("link", { name: "+ Amende" }).click();

  // Les <label> du form n'ont pas de htmlFor, donc on cible par contenu d'option.
  // Motif (premier select de la page) + Membre (deuxième).
  const selects = page.locator("select");
  await selects.nth(0).selectOption({ label: "Retard à l'entraînement" });
  await selects.nth(1).selectOption({ label: "Alice Dupont" });
  await page.getByRole("button", { name: /^déclarer$/i }).click();

  // Retour sur la page écritures avec l'amende visible
  await page.waitForURL(/\/ecritures$/);
  await expect(page.getByText(/Alice Dupont/)).toBeVisible({ timeout: 10_000 });
});
