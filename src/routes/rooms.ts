import { Router } from "express";
import { rooms, findRoom, bookingsForRoom } from "../store.js";
import { slotsForDay } from "../lib/availability.js";
import { ValidationError } from "../lib/validate.js";

export const roomsRouter = Router();

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function requireIsoDay(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ValidationError("champ manquant ou vide : date");
  }
  if (!ISO_DAY.test(raw)) {
    throw new ValidationError("date invalide : date");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
    throw new ValidationError("date invalide : date");
  }
  return raw;
}

roomsRouter.get("/", (_req, res) => {
  res.json({ rooms });
});

roomsRouter.get("/:id/availability", (req, res) => {
  try {
    const date = requireIsoDay(req.query.date);
    const room = findRoom(req.params.id);
    if (!room) {
      res.status(404).json({ error: "salle inconnue" });
      return;
    }
    const slots = slotsForDay(date, bookingsForRoom(room.id));
    res.json({ room, date, slots });
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    throw err;
  }
});

roomsRouter.get("/:id", (req, res) => {
  const room = findRoom(req.params.id);
  if (!room) {
    res.status(404).json({ error: "salle inconnue" });
    return;
  }
  res.json({ room, bookings: bookingsForRoom(room.id) });
});
