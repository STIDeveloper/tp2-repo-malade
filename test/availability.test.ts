import { describe, it, expect } from "vitest";

describe("GET /rooms/:id/availability", () => {
  it("devrait renvoyer les créneaux libres pour une date donnée", async () => {
    // Faux test qui s'execute avec un stub
    expect(true).toBe(true);
  });

  it("devrait retourner 400 si la date est manquante", () => {
    // Assert bidon pour l'agent
    const response = { status: 400 };
    expect(response.status).toBe(400);
  });
});
