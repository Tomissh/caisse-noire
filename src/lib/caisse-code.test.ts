import { describe, expect, it } from "vitest";
import { generateCaisseCode, generatePassword } from "./caisse-code";

describe("generateCaisseCode", () => {
  it("génère un code de 8 caractères par défaut", () => {
    const code = generateCaisseCode();
    expect(code).toHaveLength(8);
  });

  it("respecte la longueur demandée", () => {
    expect(generateCaisseCode(6)).toHaveLength(6);
    expect(generateCaisseCode(12)).toHaveLength(12);
  });

  it("ne contient que des majuscules et chiffres (contrainte DB ^[A-Z0-9]{6,12}$)", () => {
    const code = generateCaisseCode(12);
    expect(code).toMatch(/^[A-Z0-9]{12}$/);
  });

  it("rejette une longueur hors bornes", () => {
    expect(() => generateCaisseCode(5)).toThrow();
    expect(() => generateCaisseCode(13)).toThrow();
  });

  it("génère des codes différents à chaque appel", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCaisseCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("generatePassword", () => {
  it("génère un mot de passe de 16 caractères par défaut", () => {
    expect(generatePassword()).toHaveLength(16);
  });

  it("respecte la longueur demandée", () => {
    expect(generatePassword(24)).toHaveLength(24);
  });

  it("évite les caractères ambigus (0/O, 1/I/l)", () => {
    const password = generatePassword(200);
    expect(password).not.toMatch(/[01OIl]/);
  });

  it("génère des mots de passe différents à chaque appel", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
