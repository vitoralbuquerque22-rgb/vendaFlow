// Cliente da API do VendaFlow.
//
//   import { api } from "@/api/client";
//   await api.entities.Lead.filter({ empresaId }, "-created_date", 50);
//   await api.auth.me();
//   const { data } = await api.functions.invoke("contarLeadsEmpresa", { empresaId });
//   const { file_url } = await api.integrations.Core.UploadFile({ file });

import { io } from "socket.io-client";

const TOKEN_KEY = "vendaflow_token";

// Erro com o mesmo formato do axios (e.response.status / e.response.data),
// que é como as telas já tratam falhas das funções.
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.response = { status, data };
  }
}

// ---------- Token ----------
function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navegador sem localStorage */
  }
}

// ---------- HTTP ----------
function hasFile(data) {
  return data instanceof FormData || (data && Object.values(data).some((v) => v instanceof File || v instanceof Blob));
}

function toFormData(data) {
  if (data instanceof FormData) return data;
  const form = new FormData();
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof File) form.append(key, value, value.name);
    else if (value instanceof Blob) form.append(key, value);
    else if (value !== null && typeof value === "object") form.append(key, JSON.stringify(value));
    else if (value !== undefined) form.append(key, value);
  }
  return form;
}

async function request(method, path, { body, params, full = false } = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (body !== undefined) {
    if (hasFile(body)) {
      payload = toFormData(body);
    } else {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
  }

  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* resposta não é JSON */
  }

  if (!res.ok) {
    const message = data?.message || data?.error || data?.detail || `Erro ${res.status}`;
    throw new ApiError(message, res.status, data);
  }
  return full ? { data, status: res.status, headers: Object.fromEntries(res.headers) } : data;
}

// ---------- Tempo real ----------
let socket = null;
const roomListeners = new Map();
const conexaoListeners = new Set();

function avisarConexao(estado) {
  for (const listener of conexaoListeners) {
    try {
      listener(estado);
    } catch (err) {
      console.error("[realtime] listener de conexão falhou", err);
    }
  }
}

function getSocket() {
  if (!socket) {
    socket = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket"],
      query: { token: getToken() ?? "" },
    });
    socket.on("connect", () => {
      for (const room of roomListeners.keys()) socket.emit("join", room);
      avisarConexao("conectado");
    });
    socket.on("disconnect", () => avisarConexao("desconectado"));
    socket.on("update_model", (msg) => {
      let payload;
      try {
        payload = JSON.parse(msg.data);
      } catch {
        return;
      }
      for (const listener of roomListeners.get(msg.room) ?? []) listener(payload);
    });
  }
  return socket;
}

function resetSocket() {
  if (socket) socket.disconnect();
  socket = null;
  if (roomListeners.size) getSocket();
}

function subscribeRoom(room, listener) {
  const s = getSocket();
  if (!roomListeners.has(room)) {
    roomListeners.set(room, new Set());
    if (s.connected) s.emit("join", room);
  }
  roomListeners.get(room).add(listener);
  return () => {
    const set = roomListeners.get(room);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      roomListeners.delete(room);
      if (socket?.connected) socket.emit("leave", room);
    }
  };
}

// ---------- Entidades ----------
function listParams(query, sort, limit, skip, fields) {
  return {
    q: query ? JSON.stringify(query) : undefined,
    sort,
    limit,
    skip,
    fields: Array.isArray(fields) ? fields.join(",") : fields,
  };
}

function entityClient(name) {
  const base = `/entities/${encodeURIComponent(name)}`;
  return {
    list: (sort, limit, skip, fields) => request("GET", base, { params: listParams(null, sort, limit, skip, fields) }),
    filter: (query, sort, limit, skip, fields) => request("GET", base, { params: listParams(query, sort, limit, skip, fields) }),
    get: (id) => request("GET", `${base}/${encodeURIComponent(id)}`),
    create: (data) => request("POST", base, { body: data }),
    update: (id, data) => request("PUT", `${base}/${encodeURIComponent(id)}`, { body: data }),
    delete: (id) => request("DELETE", `${base}/${encodeURIComponent(id)}`),
    deleteMany: (query) => request("DELETE", base, { body: query }),
    bulkCreate: (items) => request("POST", `${base}/bulk`, { body: items }),
    bulkUpdate: (items) => request("PUT", `${base}/bulk`, { body: items }),
    updateMany: (query, data) => request("PATCH", `${base}/update-many`, { body: { query, data } }),
    subscribe: (callback) => subscribeRoom(`entities:${name}`, callback),
  };
}

const entities = new Proxy(
  {},
  { get: (_target, name) => (typeof name === "string" && name !== "then" ? entityClient(name) : undefined) },
);

// ---------- Login ----------
function goToLogin(fromUrl) {
  const from = fromUrl ? `?from_url=${encodeURIComponent(fromUrl)}` : "";
  window.location.href = `/login${from}`;
}

const auth = {
  me: () => request("GET", "/auth/me"),
  updateMe: (data) => request("PUT", "/auth/me", { body: data }),
  async isAuthenticated() {
    if (!getToken()) return false;
    try {
      await auth.me();
      return true;
    } catch {
      return false;
    }
  },
  setToken(token) {
    storeToken(token);
    resetSocket();
  },
  async loginViaEmailPassword(email, password) {
    const result = await request("POST", "/auth/login", { body: { email, password } });
    if (result?.access_token) auth.setToken(result.access_token);
    return result;
  },
  register: ({ email, password, full_name }) => request("POST", "/auth/register", { body: { email, password, full_name } }),
  verifyOtp: ({ email, otpCode }) => request("POST", "/auth/verify-otp", { body: { email, otp_code: otpCode } }),
  resendOtp: (email) => request("POST", "/auth/resend-otp", { body: { email } }),
  resetPasswordRequest: (email) => request("POST", "/auth/reset-password-request", { body: { email } }),
  resetPassword: ({ resetToken, newPassword }) =>
    request("POST", "/auth/reset-password", { body: { reset_token: resetToken, new_password: newPassword } }),
  changePassword: ({ currentPassword, newPassword }) =>
    request("POST", "/auth/change-password", { body: { current_password: currentPassword, new_password: newPassword } }),
  inviteUser: (email, role = "user") => request("POST", "/auth/invite", { body: { user_email: email, role } }),
  redirectToLogin: (nextUrl) => goToLogin(nextUrl ?? window.location.href),
  loginWithProvider(provider, fromUrl = "/") {
    const from = new URL(fromUrl, window.location.origin).toString();
    window.location.href = `/api/auth/${provider}?from_url=${encodeURIComponent(from)}`;
  },
  logout() {
    storeToken(null);
    resetSocket();
    goToLogin();
  },
};

// ---------- Funções do backend ----------
const functions = {
  // Devolve { data, status, headers }, como antes
  invoke(name, data = {}) {
    if (typeof data === "string") throw new Error(`A função ${name} precisa receber um objeto`);
    return request("POST", `/functions/${encodeURIComponent(name)}`, { body: data, full: true });
  },
};

// ---------- Integrações (IA, arquivos, e-mail) ----------
const integrations = {
  Core: new Proxy(
    {},
    {
      get: (_target, name) =>
        typeof name === "string" && name !== "then"
          ? (data = {}) => request("POST", `/integrations/${encodeURIComponent(name)}`, { body: data })
          : undefined,
    },
  ),
};

// ---------- Agentes de IA ----------
const agents = {
  createConversation: (conversation) => request("POST", "/agents/conversations", { body: conversation }),
  listConversations: (params) => request("GET", "/agents/conversations", { params }),
  getConversation: (id) => request("GET", `/agents/conversations/${encodeURIComponent(id)}`),
  addMessage: (conversation, message) =>
    request("POST", `/agents/conversations/${encodeURIComponent(conversation.id)}/messages`, { body: message }),
  // Chama onUpdate(conversa) a cada mensagem nova ou atualizada
  subscribeToConversation(id, onUpdate) {
    let current = null;
    const loaded = agents.getConversation(id).then((conv) => (current = conv));
    return subscribeRoom(`conversation:${id}`, async ({ _message: message }) => {
      if (!message) return;
      await loaded;
      if (!current) return;
      const messages = current.messages ?? [];
      const index = messages.findIndex((m) => m.id === message.id);
      current = {
        ...current,
        messages: index >= 0 ? messages.map((m, i) => (i === index ? message : m)) : [...messages, message],
      };
      onUpdate?.(current);
    });
  },
};

// ---------- Salas de tempo real ----------
const realtime = {
  // Recebe cada payload publicado na sala; devolve a função para sair da sala
  subscribe: (room, listener) => subscribeRoom(room, listener),
  conectado: () => !!socket?.connected,
  // listener("conectado" | "desconectado"); devolve a função para parar de ouvir
  onConexao(listener) {
    conexaoListeners.add(listener);
    return () => conexaoListeners.delete(listener);
  },
};

// ---------- Métricas de uso ----------
// Ainda não há destino para esses eventos; a chamada existe para as telas não precisarem mudar.
const analytics = {
  track() {},
};

export const api = { entities, auth, functions, integrations, agents, realtime, analytics };
