// Atualizações em tempo real via Socket.IO: o cliente entra em "salas" (join/leave)
// e recebe eventos "update_model".

import { Server } from "socket_io";

export const io = new Server({
  path: "/socket.io/",
  cors: { origin: "*" },
});

type RoomGuard = (room: string, token: string | undefined) => Promise<boolean>;
type RoomHook = (room: string, token: string | undefined) => void | Promise<void>;

let roomGuard: RoomGuard = async () => true;
let aoEntrar: RoomHook = () => {};
let aoEsvaziar: (room: string) => void = () => {};

export function setRoomGuard(guard: RoomGuard) {
  roomGuard = guard;
}

/** Callbacks de ciclo de vida das salas (usados pela ponte com o 3C Plus). */
export function setRoomHooks(hooks: { aoEntrar?: RoomHook; aoEsvaziar?: (room: string) => void }) {
  if (hooks.aoEntrar) aoEntrar = hooks.aoEntrar;
  if (hooks.aoEsvaziar) aoEsvaziar = hooks.aoEsvaziar;
}

// Quem está em cada sala (contamos nós mesmos para saber quando a sala esvazia)
const membros = new Map<string, Set<string>>();

function sair(room: string, socketId: string) {
  const set = membros.get(room);
  if (!set?.delete(socketId)) return;
  if (set.size === 0) {
    membros.delete(room);
    try {
      aoEsvaziar(room);
    } catch (err) {
      console.error("[realtime] erro ao esvaziar sala", room, err);
    }
  }
}

export function membrosNaSala(room: string): number {
  return membros.get(room)?.size ?? 0;
}

io.on("connection", (socket) => {
  const token = (socket.handshake.query.get("token") ?? undefined) as string | undefined;
  const minhasSalas = new Set<string>();

  socket.on("join", async (room: string) => {
    if (typeof room !== "string") return;
    try {
      if (!(await roomGuard(room, token))) return;
      socket.join(room);
      minhasSalas.add(room);
      if (!membros.has(room)) membros.set(room, new Set());
      membros.get(room)!.add(socket.id);
      await aoEntrar(room, token);
    } catch (err) {
      console.error("[realtime] erro ao entrar na sala", room, err);
    }
  });
  socket.on("leave", (room: string) => {
    if (typeof room !== "string") return;
    socket.leave(room);
    minhasSalas.delete(room);
    sair(room, socket.id);
  });
  socket.on("disconnect", () => {
    for (const room of minhasSalas) sair(room, socket.id);
    minhasSalas.clear();
  });
});

export function emitToRoom(room: string, payload: unknown) {
  io.to(room).emit("update_model", { room, data: JSON.stringify(payload) });
}

// Avisa quem está inscrito em uma entidade (entities.X.subscribe)
export function broadcast(entity: string, type: "create" | "update" | "delete", data: Record<string, unknown>) {
  emitToRoom(`entities:${entity}`, {
    type,
    data,
    id: data.id,
    timestamp: new Date().toISOString(),
  });
}
