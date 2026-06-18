import { test, expect } from "@playwright/test";
import { FIXTURES } from "../setup/env";

// Clôture (créateur) + réouverture (super-admin uniquement).
// Test combiné pour rester déterministe : clôture puis réouverture sur la même caisse.

test("clôture par admin créateur → réouverture par super-admin", async ({ page }) => {
  // === Étape 1 : clôture en tant qu'admin créateur ===
  await page.goto("/login");
  await page.getByLabel("Email").fill(FIXTURES.admin.email);
  await page.getByLabel("Mot de passe").fill(FIXTURES.admin.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/admin");

  await page.getByRole("link", { name: FIXTURES.caisse.nom }).click();
  await page.waitForURL(/\/admin\/caisses\/[\da-f-]+$/);

  await page.getByRole("link", { name: /paramètres/i }).click();
  await page.getByRole("button", { name: /clôturer/i }).click();
  // Confirmation par retape du nom
  await page.getByLabel(/nom de la caisse/i).fill(FIXTURES.caisse.nom);
  await page.getByRole("button", { name: /confirmer|clôturer définitivement/i }).click();

  await expect(page.getByText(/clôturée/i)).toBeVisible({ timeout: 10_000 });

  // === Étape 2 : réouverture en tant que super-admin ===
  await page.getByRole("button", { name: /se déconnecter/i }).click();
  await page.waitForURL("**/login");

  await page.getByLabel("Email").fill(FIXTURES.superAdmin.email);
  await page.getByLabel("Mot de passe").fill(FIXTURES.superAdmin.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/admin");

  await page.getByRole("link", { name: /super|réouvrir|caisses clôturées/i }).first().click();
  await page.getByRole("button", { name: /réouvrir/i }).click();

  // Retour caisse active
  await expect(page.getByText(/clôturée/i)).toBeHidden({ timeout: 10_000 });
});
