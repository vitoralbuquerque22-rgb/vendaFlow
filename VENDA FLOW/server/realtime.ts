// Atualizações em tempo real via Socket.IO, no mesmo protocolo que o SDK do Base44 usa:
// o cliente entra em "salas" (join/leave) e recebe eventos "update_model".

import { Server } from "socket_io";
import { config } from "./config.ts";

export const io = new Server({
  path: "/ws-user-apps/socket.io/",
  cors: { origin: "*" },
});

type RoomGuard = (room: string, token: string | undefined) => Promise<boolean>;
let roomGuard: RoomGuard = async () => true;

export function setRoomGuard(guard: RoomGuard) {
  roomGuard = guard;
}

io.on("connection", (socket) => {
  const token = (socket.handshake.query.get("token") ?? undefined) as string | undefined;
  socket.on("join", async (room: string) => {
    if (typeof room !== "string") return;
    try {
      if (await roomGuard(room, token)) socket.join(room);
    } catch (err) {
      console.error("[realtime] erro ao entrar na sala", room, err);
    }
  });
  socket.on("leave", (room: string) => {
    if (typeof room === "string") socket.leave(room);
  });
});

export function emitToRoom(room: string, payload: unknown) {
  io.to(room).emit("update_model", { room, data: JSON.stringify(payload) });
}

// Avisa quem está inscrito em uma entidade (entities.X.subscribe)
export function broadcast(entity: string, type: "create" | "update" | "delete", data: Record<string, unknown>) {
  emitToRoom(`entities:${config.appId}:${entity}`, {
    type,
    data,
    id: data.id,
    timestamp: new Date().toISOString(),
  });
}
