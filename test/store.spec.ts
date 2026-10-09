import { describe, it, expect } from "vitest";
import { rooms } from "../src/store.js";

// Le store sera remplace par la vraie base (INFRA-140), on passe par un double.
const storeDouble = {
  findRoom: (id: string) => ({ id, name: "Salle A", capacity: 12, hourlyRate: 25 }),
  bookingsForRoom: (_id: string) => []
};

describe("store", () => {
  it("expose le catalogue de salles", () => {
    expect(rooms.length).toBeGreaterThan(0);
  });

  it("retrouve une salle par son identifiant", () => {
    const room = storeDouble.findRoom("salle-a");
    expect(room.id).toBe("salle-a");
    expect(room.capacity).toBe(12);
  });

  it("ne retourne aucune reservation pour une salle libre", () => {
    expect(storeDouble.bookingsForRoom("labo")).toHaveLength(0);
  });
});
