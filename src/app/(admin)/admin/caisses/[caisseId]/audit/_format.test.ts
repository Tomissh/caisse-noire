import { describe, expect, it } from "vitest";
import { formatAuditAction } from "./_format";

const membresById = new Map([
  ["m1", { prenom: "Alice", nom: "Martin" }],
]);
const emailsById = new Map([["u1", "alice@example.com"]]);

describe("formatAuditAction", () => {
  it("formate une création d'amende avec membre, libellé et montant", () => {
    const result = formatAuditAction(
      "amende.create",
      { membre_id: "m1", libelle: "Retard entraînement", montant_centimes: 500 },
      membresById,
      emailsById,
    );
    expect(result).toEqual({
      kind: "text",
      label: "Amende déclarée",
      detail: "Alice Martin — Retard entraînement — 5,00 €",
    });
  });

  it("omet les champs absents du payload sans planter", () => {
    const result = formatAuditAction("amende.create", {}, membresById, emailsById);
    expect(result).toEqual({ kind: "text", label: "Amende déclarée", detail: "" });
  });

  it("formate une suppression d'amende avec motif", () => {
    const result = formatAuditAction(
      "amende.delete",
      { motif_suppression: "erreur de saisie" },
      membresById,
      emailsById,
    );
    expect(result).toEqual({
      kind: "text",
      label: "Amende supprimée",
      detail: "motif : erreur de saisie",
    });
  });

  it("traduit le moyen de paiement", () => {
    const result = formatAuditAction(
      "paiement.create",
      { membre_id: "m1", montant_centimes: 1000, moyen: "virement" },
      membresById,
      emailsById,
    );
    expect(result).toEqual({
      kind: "text",
      label: "Paiement enregistré",
      detail: "Alice Martin — 10,00 € — virement",
    });
  });

  it("construit un diff lisible pour caisse.update", () => {
    const result = formatAuditAction(
      "caisse.update",
      { nom: ["Ancien nom", "Nouveau nom"], actif: [true, false] },
      membresById,
      emailsById,
    );
    expect(result.kind).toBe("text");
    expect((result as { detail?: string }).detail).toContain("nom: Ancien nom → Nouveau nom");
    expect((result as { detail?: string }).detail).toContain("actif: oui → non");
  });

  it("convertit les centimes en euros dans le diff quand la clé contient 'centimes'", () => {
    const result = formatAuditAction(
      "caisse.update",
      { montant_centimes: [500, 1000] },
      membresById,
      emailsById,
    );
    expect((result as { detail?: string }).detail).toBe("montant_centimes: 5€ → 10€");
  });

  it("affiche ∅ pour les valeurs nulles dans un diff", () => {
    const result = formatAuditAction(
      "membre.update",
      { email: [null, "test@example.com"] },
      membresById,
      emailsById,
    );
    expect((result as { detail?: string }).detail).toBe("email: ∅ → test@example.com");
  });

  it("résout l'email d'un admin ajouté via emailsById", () => {
    const result = formatAuditAction("admin.add", { user_id: "u1" }, membresById, emailsById);
    expect(result).toEqual({ kind: "text", label: "Admin ajouté", detail: "alice@example.com" });
  });

  it("retombe sur un id tronqué si l'email est inconnu", () => {
    const result = formatAuditAction(
      "admin.add",
      { user_id: "unknown-user-id-123" },
      membresById,
      emailsById,
    );
    expect(result).toEqual({ kind: "text", label: "Admin ajouté", detail: "unknown-…" });
  });

  it("retombe sur un dump JSON pour une action inconnue", () => {
    const payload = { foo: "bar" };
    const result = formatAuditAction("action.inconnue", payload, membresById, emailsById);
    expect(result).toEqual({ kind: "json", label: "action.inconnue", raw: payload });
  });

  it("gère les actions sans détail (cloture, réouverture, suppression de caisse)", () => {
    expect(formatAuditAction("caisse.cloture", {}, membresById, emailsById)).toEqual({
      kind: "text",
      label: "Caisse clôturée",
    });
    expect(formatAuditAction("caisse.reouverture", {}, membresById, emailsById)).toEqual({
      kind: "text",
      label: "Caisse réouverte",
    });
    expect(formatAuditAction("caisse.delete", {}, membresById, emailsById)).toEqual({
      kind: "text",
      label: "Caisse supprimée",
    });
  });
});
