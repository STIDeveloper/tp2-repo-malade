import { createApp } from "../../src/app.js";
import type { Booking, Room } from "../../src/store.js";
import type { RoomSlot } from "../../src/lib/availability.js";

/** Corps JSON possibles des reponses de l'API. */
export interface ApiBody {
  ok?: boolean;
  error?: string;
  conflictsWith?: string;
  cancelled?: string;
  room?: Room;
  rooms?: Room[];
  booking?: Booking;
  bookings?: Booking[];
  date?: string;
  slots?: RoomSlot[];
}

/** Demarre l'application sur un port libre, envoie une requete, puis arrete le serveur. */
export async function call(path: string, init?: RequestInit) {
  const server = createApp().listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, init);
    return { status: res.status, body: (await res.json()) as ApiBody };
  } finally {
    server.close();
  }
}

/** POST /bookings avec une charge utile JSON. */
export const post = (payload: unknown) =>
  call("/bookings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
