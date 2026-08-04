import { describe, expect, it } from "vitest";
import { centimesToEuros, eurosToCentimes, formatEuros, formatSolde } from "./format";

describe("eurosToCentimes", () => {
  it("convertit des euros entiers", () => {
    expect(eurosToCentimes(5)).toBe(500);
    expect(eurosToCentimes(0)).toBe(0);
  });

  it("arrondit pour absorber les erreurs de flottant", () => {
    expect(eurosToCentimes(19.99)).toBe(1999);
    expect(eurosToCentimes(0.1 + 0.2)).toBe(30);
  });

  it("gère les négatifs", () => {
    expect(eurosToCentimes(-5)).toBe(-500);
  });
});

describe("centimesToEuros", () => {
  it("convertit des centimes en euros", () => {
    expect(centimesToEuros(500)).toBe(5);
    expect(centimesToEuros(0)).toBe(0);
    expect(centimesToEuros(1999)).toBe(19.99);
  });
});

describe("formatEuros", () => {
  it("formate avec deux décimales et virgule", () => {
    expect(formatEuros(500)).toBe("5,00 €");
    expect(formatEuros(1999)).toBe("19,99 €");
  });

  it("ne préfixe jamais avec un signe", () => {
    expect(formatEuros(0)).toBe("0,00 €");
    expect(formatEuros(-500)).toBe("-5,00 €");
  });

  it("gère les grands montants", () => {
    expect(formatEuros(123456789)).toBe("1234567,89 €");
  });
});

describe("formatSolde", () => {
  it("affiche 0,00 € sans signe pour un solde nul", () => {
    expect(formatSolde(0)).toBe("0,00 €");
  });

  it("préfixe les soldes positifs avec +", () => {
    expect(formatSolde(500)).toBe("+5,00 €");
    expect(formatSolde(1)).toBe("+0,01 €");
  });

  it("préfixe les soldes négatifs avec − (moins typographique)", () => {
    expect(formatSolde(-500)).toBe("−5,00 €");
    expect(formatSolde(-1)).toBe("−0,01 €");
  });
});
