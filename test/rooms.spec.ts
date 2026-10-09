import { describe, it, expect } from "vitest";
import { call } from "./helpers/http.js";

const get = (path: string) => call(path);

describe("GET /health", () => {
  it("repond ok", async () => {
    expect(await get("/health")).toEqual({ status: 200, body: { ok: true } });
  });
});

describe("GET /rooms", () => {
  it("liste le catalogue", async () => {
    const res = await get("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.rooms).toHaveLength(4);
  });
});

describe("GET /rooms/:id", () => {
  it("renvoie la salle et ses reservations", async () => {
    const res = await get("/rooms/amphi");
    expect(res.status).toBe(200);
    expect(res.body.room?.name).toBe("Amphi Turing");
    expect(res.body.bookings?.map((b) => b.id)).toContain("bk-1002");
  });

  it("repond 404 pour une salle inconnue", async () => {
    const res = await get("/rooms/cave");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("salle inconnue");
  });
});

describe("GET /rooms/:id/availability", () => {
  it("renvoie 12 creneaux libres pour une salle sans reservation", async () => {
    const res = await get("/rooms/salle-b/availability?date=2026-10-05");
    expect(res.status).toBe(200);
    expect(res.body.room?.id).toBe("salle-b");
    expect(res.body.date).toBe("2026-10-05");
    expect(res.body.slots).toHaveLength(12);
    expect(res.body.slots?.[0]?.startsAt).toBe("2026-10-05T08:00:00Z");
    expect(res.body.slots?.[11]?.endsAt).toBe("2026-10-05T20:00:00Z");
    expect(res.body.slots?.every((s) => s.available === true)).toBe(true);
  });

  it("marque les creneaux chevauchant une reservation existante", async () => {
    const res = await get("/rooms/salle-a/availability?date=2026-10-05");
    expect(res.status).toBe(200);
    expect(res.body.slots?.filter((s) => !s.available).map((s) => s.startsAt)).toEqual([
      "2026-10-05T09:00:00Z",
      "2026-10-05T10:00:00Z"
    ]);
  });

  it("occupe plusieurs creneaux pour une reservation multi-heures", async () => {
    const res = await get("/rooms/amphi/availability?date=2026-10-06");
    expect(res.status).toBe(200);
    const occupees = res.body.slots?.filter((s) => !s.available);
    expect(occupees).toHaveLength(3);
    expect(occupees?.map((s) => s.startsAt)).toEqual([
      "2026-10-06T14:00:00Z",
      "2026-10-06T15:00:00Z",
      "2026-10-06T16:00:00Z"
    ]);
  });

  it("repond 404 pour une salle inconnue", async () => {
    const res = await get("/rooms/cave/availability?date=2026-10-05");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("salle inconnue");
  });

  it("repond 400 quand la date manque", async () => {
    const res = await get("/rooms/salle-a/availability");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("champ manquant ou vide : date");
  });

  it("repond 400 pour une date au mauvais format", async () => {
    const res = await get("/rooms/salle-a/availability?date=2026/10/05");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("date invalide : date");
  });

  it("repond 400 pour une date irreelle", async () => {
    const res = await get("/rooms/salle-a/availability?date=2026-13-01");
    expect(res.status).toBe(400);
  });

  it("repond 400 pour une date calendaire impossible", async () => {
    const res = await get("/rooms/salle-a/availability?date=2026-02-30");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("date invalide : date");
  });

  it("accepte un 29 fevrier reellement bissextile", async () => {
    const res = await get("/rooms/salle-b/availability?date=2024-02-29");
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2024-02-29");
  });
});
