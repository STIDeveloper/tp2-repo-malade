import { describe, it, expect } from "vitest";
import { call, post } from "./helpers/http.js";

describe("POST /bookings", () => {
  it("refuse une salle inconnue", async () => {
    const res = await post({
      roomId: "cave",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse un depassement de capacite", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 40,
      startsAt: "2026-11-02T09:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse une date invalide", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "la semaine prochaine",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("refuse un creneau qui finit avant de commencer", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-02T11:00:00Z",
      endsAt: "2026-11-02T10:00:00Z"
    });
    expect(res.status).toBe(400);
  });

  it("accepte une reservation qui commence quand la precedente finit", async () => {
    const first = await post({
      roomId: "labo",
      who: "equipe-1",
      people: 4,
      startsAt: "2026-11-03T09:00:00Z",
      endsAt: "2026-11-03T10:00:00Z"
    });
    expect(first.status).toBe(201);

    const second = await post({
      roomId: "labo",
      who: "equipe-2",
      people: 4,
      startsAt: "2026-11-03T10:00:00Z",
      endsAt: "2026-11-03T11:00:00Z"
    });
    expect(second.status).toBe(201);
  });
});

describe("POST /bookings (suite)", () => {
  it("refuse un creneau qui chevauche une reservation existante", async () => {
    const res = await post({
      roomId: "salle-a",
      who: "moi",
      people: 2,
      startsAt: "2026-10-05T10:00:00Z",
      endsAt: "2026-10-05T12:00:00Z"
    });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "creneau deja reserve", conflictsWith: "bk-1001" });
  });

  it("refuse un champ manquant et un nombre de personnes non entier", async () => {
    const sansQui = await post({
      roomId: "salle-b",
      people: 2,
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T10:00:00Z"
    });
    expect(sansQui.status).toBe(400);
    expect(sansQui.body.error).toContain("who");

    const decimal = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2.5,
      startsAt: "2026-11-04T09:00:00Z",
      endsAt: "2026-11-04T10:00:00Z"
    });
    expect(decimal.status).toBe(400);
    expect(decimal.body.error).toContain("people");
  });

  it("cree la reservation avec son prix et la rend visible dans la salle", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "equipe-3",
      people: 6,
      startsAt: "2026-11-05T14:00:00Z",
      endsAt: "2026-11-05T16:00:00Z"
    });
    expect(res.status).toBe(201);
    expect(res.body.booking).toMatchObject({ roomId: "salle-b", people: 6, price: 30 });

    const salle = await call("/rooms/salle-b");
    expect(salle.body.bookings?.map((b) => b.id)).toContain(res.body.booking?.id);
  });
});

describe("POST /bookings (bornes)", () => {
  it("refuse un creneau de duree nulle", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "moi",
      people: 2,
      startsAt: "2026-11-07T09:00:00Z",
      endsAt: "2026-11-07T09:00:00Z"
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("endsAt doit etre posterieur a startsAt");
  });

  it("explique le refus pour une salle inconnue et une capacite depassee", async () => {
    const base = { who: "moi", startsAt: "2026-11-07T09:00:00Z", endsAt: "2026-11-07T10:00:00Z" };
    expect((await post({ ...base, roomId: "cave", people: 2 })).body.error).toBe("salle inconnue : cave");
    expect((await post({ ...base, roomId: "salle-b", people: 7 })).body.error).toBe("capacite depassee : 7 > 6");
  });

  it("accepte exactement la capacite de la salle", async () => {
    const res = await post({
      roomId: "salle-b",
      who: "equipe-5",
      people: 6,
      startsAt: "2026-11-08T09:00:00Z",
      endsAt: "2026-11-08T10:00:00Z"
    });
    expect(res.status).toBe(201);
  });
});

describe("GET /bookings", () => {
  it("filtre par salle", async () => {
    const res = await call("/bookings?roomId=amphi");
    expect(res.status).toBe(200);
    expect(res.body.bookings?.length).toBeGreaterThan(0);
    expect(res.body.bookings?.every((b) => b.roomId === "amphi")).toBe(true);
  });

  it("renvoie toutes les reservations sans filtre", async () => {
    const res = await call("/bookings");
    const salles = new Set(res.body.bookings?.map((b) => b.roomId));
    expect(salles.has("amphi") && salles.has("salle-a")).toBe(true);
  });
});

describe("DELETE /bookings/:id", () => {
  it("annule une reservation puis repond 404 a la seconde annulation", async () => {
    const created = await post({
      roomId: "amphi",
      who: "equipe-4",
      people: 30,
      startsAt: "2026-11-06T08:00:00Z",
      endsAt: "2026-11-06T09:00:00Z"
    });
    const id = created.body.booking?.id;

    const first = await call(`/bookings/${id}`, { method: "DELETE" });
    expect(first.status).toBe(200);
    expect(first.body.cancelled).toBe(id);

    const second = await call(`/bookings/${id}`, { method: "DELETE" });
    expect(second.status).toBe(404);
    expect(second.body.error).toBe("reservation inconnue");
  });
});
