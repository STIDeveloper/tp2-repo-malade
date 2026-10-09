import { describe, it, expect } from "vitest";
import { slotsForDay } from "../src/lib/availability.js";
import type { Booking } from "../src/store.js";

const booking = (startsAt: string, endsAt: string): Booking => ({
  id: "bk-test",
  roomId: "salle-a",
  who: "test",
  people: 1,
  startsAt,
  endsAt,
  price: 0
});

describe("slotsForDay", () => {
  it("produit 12 creneaux contigus de 08:00 a 20:00", () => {
    const slots = slotsForDay("2026-10-05", []);
    expect(slots).toHaveLength(12);
    expect(slots[0]).toEqual({
      startsAt: "2026-10-05T08:00:00Z",
      endsAt: "2026-10-05T09:00:00Z",
      available: true
    });
    expect(slots[11]).toEqual({
      startsAt: "2026-10-05T19:00:00Z",
      endsAt: "2026-10-05T20:00:00Z",
      available: true
    });
    expect(slots.every((s) => s.available)).toBe(true);
    for (let i = 0; i < slots.length - 1; i += 1) {
      expect(slots[i].endsAt).toBe(slots[i + 1].startsAt);
    }
  });

  it("occupe les bornes semi-ouvertes [debut, fin[", () => {
    const slots = slotsForDay("2026-10-05", [
      booking("2026-10-05T09:00:00Z", "2026-10-05T11:00:00Z")
    ]);
    expect(slots.filter((s) => !s.available).map((s) => s.startsAt)).toEqual([
      "2026-10-05T09:00:00Z",
      "2026-10-05T10:00:00Z"
    ]);
    expect(slots[0].available).toBe(true);
    expect(slots[3].available).toBe(true);
  });

  it("ignore une reservation hors amplitude d'ouverture", () => {
    const slots = slotsForDay("2026-10-05", [
      booking("2026-10-05T06:00:00Z", "2026-10-05T07:00:00Z")
    ]);
    expect(slots).toHaveLength(12);
    expect(slots.every((s) => s.available)).toBe(true);
  });

  it("ignore une reservation qui deborde de la veille sur minuit", () => {
    const slots = slotsForDay("2026-10-05", [
      booking("2026-10-04T23:00:00Z", "2026-10-05T01:00:00Z")
    ]);
    expect(slots).toHaveLength(12);
    expect(slots.every((s) => s.available)).toBe(true);
  });
});
