import type { Booking } from "../store.js";
import { overlaps } from "./overlap.js";

/** Un creneau horaire d'une heure, libre ou occupe par une reservation. */
export interface RoomSlot {
  startsAt: string;
  endsAt: string;
  available: boolean;
}

const OPENING_HOUR = 8;
const CLOSING_HOUR = 20;

/** Renvoie les 12 creneaux horaires [08:00, 20:00[ d'une journee, libres ou occupes. */
export function slotsForDay(date: string, bookings: Booking[]): RoomSlot[] {
  const pad = (hour: number) => String(hour).padStart(2, "0");
  const slots: RoomSlot[] = [];
  for (let h = OPENING_HOUR; h < CLOSING_HOUR; h += 1) {
    const startsAt = `${date}T${pad(h)}:00:00Z`;
    const endsAt = `${date}T${pad(h + 1)}:00:00Z`;
    const available = !bookings.some((b) => overlaps(startsAt, endsAt, b.startsAt, b.endsAt));
    slots.push({ startsAt, endsAt, available });
  }
  return slots;
}

export default slotsForDay;
