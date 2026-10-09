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
