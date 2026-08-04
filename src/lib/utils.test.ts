import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("fusionne des classes simples", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("résout les conflits Tailwind en gardant la dernière classe", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("supporte les classes conditionnelles via objet", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });
});
