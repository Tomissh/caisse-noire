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
  await page.getByRole("button", { name: "Clôturer la caisse" }).click();
  // Confirmation par retape du nom (input avec placeholder, pas de label)
  await page.getByPlaceholder("Nom de la caisse").fill(FIXTURES.caisse.nom);
  await page.getByRole("button", { name: /confirmer la clôture/i }).click();

  await expect(page.getByText(/clôturée/i)).toBeVisible({ timeout: 10_000 });

  // === Étape 2 : réouverture en tant que super-admin ===
  await page.getByRole("button", { name: /se déconnecter/i }).click();
  await page.waitForURL("**/login");

  await page.getByLabel("Email").fill(FIXTURES.superAdmin.email);
  await page.getByLabel("Mot de passe").fill(FIXTURES.superAdmin.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/admin");

  // Pas de lien depuis /admin → on navigue directement à /admin/super/caisses
  await page.goto("/admin/super/caisses");

  // Le ReouvrirButton invoque window.confirm — on l'accepte automatiquement.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^réouvrir$/i }).click();

  // La caisse devient "ouverte" — le badge "clôturée" disparaît de la ligne.
  await expect(
    page.getByRole("listitem").filter({ hasText: FIXTURES.caisse.nom }).getByText(/ouverte/i),
  ).toBeVisible({ timeout: 10_000 });
});
