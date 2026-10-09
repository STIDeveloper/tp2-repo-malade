import { describe, it, expect } from "vitest";
import { requireString, requireDate, requirePositiveInt, ValidationError } from "../src/lib/validate.js";

describe("requireString", () => {
  it("renvoie la valeur", () => {
    expect(requireString({ who: "moi" }, "who")).toBe("moi");
  });

  it("refuse une chaine faite d'espaces, un champ absent et un non-texte", () => {
    expect(() => requireString({ who: "   " }, "who")).toThrow("champ manquant ou vide : who");
    expect(() => requireString({}, "who")).toThrow(ValidationError);
    expect(() => requireString({ who: 42 }, "who")).toThrow(ValidationError);
  });
});

describe("requireDate", () => {
  it("accepte une date ISO et refuse le reste avec le nom du champ", () => {
    expect(requireDate({ d: "2026-11-02T09:00:00Z" }, "d")).toBe("2026-11-02T09:00:00Z");
    expect(() => requireDate({ d: "demain" }, "d")).toThrow("date invalide : d");
  });
});

describe("requirePositiveInt", () => {
  it("accepte un entier strictement positif", () => {
    expect(requirePositiveInt({ n: 1 }, "n")).toBe(1);
  });

  it("refuse zero, un negatif, un decimal et un nombre ecrit en texte", () => {
    for (const n of [0, -3, 2.5, "4"]) {
      expect(() => requirePositiveInt({ n }, "n")).toThrow("entier positif attendu : n");
    }
  });

  it("porte le statut HTTP 400", () => {
    expect(new ValidationError("x").status).toBe(400);
  });
});
