// Ponte de eventos em tempo real do 3C Plus.
//
// O navegador não conecta mais no socket do 3C Plus: o token de serviço de agente opera por
// QUALQUER agente da empresa e não pode sair do servidor. O backend abre a conexão com o 3C e
// repassa os eventos pelo nosso próprio Socket.IO:
//
//   sala telefonia:agente:<userId>     → eventos do agente do usuário (token de agente + agent_id)
//   sala telefonia:gestor:<empresaId>  → eventos de todos os agentes (token de gestor), para monitoramento
//
// Cada evento chega ao navegador como { evento, data }. Eventos do ciclo de vida da própria
// ponte usam o prefixo "__ponte:" (connect, disconnect, reconnect, connect_error).
// A conexão com o 3C fecha 60s depois que a sala fica sem ninguém.

import { io as ioCliente, type Socket } from "socket.io-client";
import { type AuthContext, findUserById, isAdmin, type UserRow } from "./auth.ts";
import { bindRequestAuth, createClientFromRequest } from "./sdk.ts";
import { type Credencial3C, credencialAgente, credencialGestor, mascarar } from "./telefonia3c.ts";
import { emitToRoom, membrosNaSala } from "./realtime.ts";

const SOCKET_3C = Deno.env.get("THREEC_SOCKET_URL") || "https://socket.3c.plus";
const FECHAR_APOS_MS = 60_000;

// Papéis (nível ≥ 4 em systemRoles) que podem monitorar todos os agentes da empresa
const PAPEIS_MONITOR = new Set(["super_admin", "admin", "gestor_empresa", "gerente_empresa", "gerente_filial", "supervisor", "gestor"]);

interface Ponte {
  sala: string;
  chave: string; // identifica a credencial usada (troca de empresa/agente reabre a ponte)
  socket: Socket;
  timerFechar?: number;
}

const pontes = new Map<string, Ponte>();

function clienteServico(user: UserRow | null) {
  const req = new Request("http://interno/ponte3c");
  const ctx: AuthContext = { user, service: true };
  bindRequestAuth(req, ctx);
  return createClientFromRequest(req);
}

export function salaAgente(userId: string) {
  return `telefonia:agente:${userId}`;
}

export function salaGestor(empresaId: string) {
  return `telefonia:gestor:${empresaId}`;
}

// ── Permissões ──
export async function podeEntrar(sala: string, user: UserRow | null): Promise<boolean> {
  if (!user) return false;
  const agente = sala.match(/^telefonia:agente:(.+)$/);
  if (agente) return agente[1] === user.id;
  const gestor = sala.match(/^telefonia:gestor:(.+)$/);
  if (gestor) return await podeMonitorar(user, gestor[1]);
  return false;
}

async function podeMonitorar(user: UserRow, empresaId: string): Promise<boolean> {
  if (isAdmin(user)) return true;
  const api = clienteServico(user);
  const [empresa] = await api.asServiceRole.entities.Empresa.filter({ id: empresaId });
  if (empresa?.ownerEmail && empresa.ownerEmail.toLowerCase() === user.email.toLowerCase()) return true;
  const vinculos = await api.asServiceRole.entities.VinculoEmpresa.filter({ empresaId, userEmail: user.email });
  if (vinculos.some((v: any) => v.status !== "inativo" && PAPEIS_MONITOR.has(v.papel))) return true;
  const [perfil] = await api.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
  return !!perfil && PAPEIS_MONITOR.has(perfil.role) && (!perfil.empresaId || perfil.empresaId === empresaId);
}

// ── Abertura das pontes ──
export async function aoEntrarNaSala(sala: string, user: UserRow | null) {
  if (!user) return;
  const agente = sala.match(/^telefonia:agente:(.+)$/);
  if (agente) {
    const empresaId = String(user.data?.empresaAtualId ?? "");
    if (!empresaId) return avisar(sala, "__ponte:connect_error", { message: "Usuário sem empresa selecionada" });
    return await abrir(sala, () => credencialAgente(clienteServico(user), empresaId, user.email));
  }
  const gestor = sala.match(/^telefonia:gestor:(.+)$/);
  if (gestor) return await abrir(sala, () => credencialGestor(clienteServico(user), gestor[1]));
}

// Uma abertura por sala por vez (duas abas entrando juntas não podem criar duas conexões)
const filaPorSala = new Map<string, Promise<void>>();

function abrir(sala: string, obterCredencial: () => Promise<Credencial3C>): Promise<void> {
  const anterior = filaPorSala.get(sala) ?? Promise.resolve();
  const atual = anterior.then(() => abrirAgora(sala, obterCredencial)).catch((err) => {
    console.error(`[ponte3c] falha ao abrir ${sala}:`, err);
  });
  filaPorSala.set(sala, atual);
  atual.finally(() => {
    if (filaPorSala.get(sala) === atual) filaPorSala.delete(sala);
  });
  return atual;
}

async function abrirAgora(sala: string, obterCredencial: () => Promise<Credencial3C>) {
  const existente = pontes.get(sala);
  if (existente?.timerFechar) {
    clearTimeout(existente.timerFechar);
    existente.timerFechar = undefined;
  }

  let cred: Credencial3C;
  try {
    cred = await obterCredencial();
  } catch (err) {
    return avisar(sala, "__ponte:connect_error", { message: err instanceof Error ? err.message : String(err) });
  }

  const chave = `${cred.papel}:${cred.origem}:${cred.dominio}:${cred.agenteId ?? ""}:${mascarar(cred.token)}`;
  if (existente && existente.chave === chave) {
    // Já conectada: avisa o recém-chegado do estado atual
    if (existente.socket.connected) avisar(sala, "__ponte:connect", {});
    return;
  }
  if (existente) fechar(sala);

  const query: Record<string, string> = { token: cred.token };
  if (cred.agenteId) query.agent_id = String(cred.agenteId);

  const socket = ioCliente(SOCKET_3C, {
    transports: ["websocket"],
    query,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
  });
  const rotulo = `${sala} (${cred.papel}${cred.agenteId ? ` #${cred.agenteId}` : ""})`;

  socket.on("connect", () => {
    console.log(`[ponte3c] conectada: ${rotulo}`);
    avisar(sala, "__ponte:connect", {});
  });
  socket.on("disconnect", (reason) => {
    console.warn(`[ponte3c] desconectada: ${rotulo} — ${reason}`);
    avisar(sala, "__ponte:disconnect", { reason });
  });
  socket.on("connect_error", (err) => {
    console.error(`[ponte3c] erro de conexão: ${rotulo} — ${err.message}`);
    avisar(sala, "__ponte:connect_error", { message: err.message });
  });
  socket.io.on("reconnect", () => avisar(sala, "__ponte:reconnect", {}));
  socket.onAny((evento: string, data: unknown) => emitToRoom(sala, { evento, data }));

  pontes.set(sala, { sala, chave, socket });
}

function avisar(sala: string, evento: string, data: unknown) {
  emitToRoom(sala, { evento, data });
}

function fechar(sala: string) {
  const ponte = pontes.get(sala);
  if (!ponte) return;
  clearTimeout(ponte.timerFechar);
  ponte.socket.removeAllListeners();
  ponte.socket.disconnect();
  pontes.delete(sala);
  console.log(`[ponte3c] fechada: ${sala}`);
}

/** Sala sem ninguém: fecha a conexão com o 3C depois de um tempo (F5 não derruba a ponte). */
export function aoEsvaziarSala(sala: string) {
  const ponte = pontes.get(sala);
  if (!ponte) return;
  clearTimeout(ponte.timerFechar);
  ponte.timerFechar = setTimeout(() => {
    if (membrosNaSala(sala) === 0) fechar(sala);
  }, FECHAR_APOS_MS);
}

export async function usuarioDaSala(token: string | undefined, getAuth: (req: Request) => Promise<AuthContext>) {
  if (!token) return null;
  const ctx = await getAuth(new Request("http://local", { headers: { Authorization: `Bearer ${token}` } })).catch(() => null);
  return ctx?.user ? await findUserById(ctx.user.id) : null;
}

export function statusPontes() {
  return [...pontes.values()].map((p) => ({ sala: p.sala, conectada: p.socket.connected, membros: membrosNaSala(p.sala) }));
}
