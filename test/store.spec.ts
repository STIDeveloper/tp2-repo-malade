import { describe, it, expect } from "vitest";
import { rooms, bookings, findRoom, bookingsForRoom, nextBookingId } from "../src/store.js";

// On teste le vrai store en memoire : c'est lui que les routes utilisent tant
// qu'INFRA-140 n'est pas livre. Un double defini ici ne prouverait rien.
describe("store", () => {
  it("expose le catalogue de salles", () => {
    expect(rooms.map((r) => r.id)).toEqual(["amphi", "salle-a", "salle-b", "labo"]);
  });

  it("retrouve une salle par son identifiant", () => {
    const room = findRoom("salle-a");
    expect(room).toEqual({ id: "salle-a", name: "Salle A", capacity: 12, hourlyRate: 25 });
  });

  it("ne retrouve pas une salle inconnue", () => {
    expect(findRoom("cave")).toBeUndefined();
  });

  it("ne retourne que les reservations de la salle demandee", () => {
    const amphi = bookingsForRoom("amphi");
    expect(amphi.length).toBeGreaterThan(0);
    expect(amphi.every((b) => b.roomId === "amphi")).toBe(true);
    expect(amphi.map((b) => b.id)).toContain("bk-1002");
  });

  it("ne retourne aucune reservation pour une salle sans reservation", () => {
    expect(bookingsForRoom("salle-b")).toEqual([]);
  });

  it("genere des identifiants uniques et croissants", () => {
    const a = nextBookingId();
    const b = nextBookingId();
    expect(a).toMatch(/^bk-\d+$/);
    expect(Number(b.slice(3))).toBe(Number(a.slice(3)) + 1);
    expect(bookings.map((x) => x.id)).not.toContain(a);
  });
});
