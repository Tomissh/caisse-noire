import { test, expect } from "@playwright/test";
import { FIXTURES } from "../setup/env";

// Export PDF récapitulatif : on déclenche la route et on vérifie le content-type + taille minimale.

test("admin : export PDF récapitulatif retourne un PDF valide", async ({ page, request }) => {
  // Login admin pour récupérer la session cookie
  await page.goto("/login");
  await page.getByLabel("Email").fill(FIXTURES.admin.email);
  await page.getByLabel("Mot de passe").fill(FIXTURES.admin.password);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL("**/admin");

  // Ouvrir la caisse pour récupérer son ID dans l'URL
  await page.getByRole("link", { name: FIXTURES.caisse.nom }).click();
  await page.waitForURL(/\/admin\/caisses\/([\da-f-]+)$/);
  const url = page.url();
  const caisseId = url.match(/\/admin\/caisses\/([\da-f-]+)/)?.[1];
  expect(caisseId).toBeTruthy();

  // Récupérer le PDF avec les cookies de la session
  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const res = await request.get(`/api/caisses/${caisseId}/recap.pdf`, {
    headers: { Cookie: cookieHeader },
  });

  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.length).toBeGreaterThan(1000); // PDF minimal a au moins 1ko
  expect(body.subarray(0, 4).toString()).toBe("%PDF"); // signature PDF
});
