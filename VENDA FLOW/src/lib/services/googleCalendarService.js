/**
 * googleCalendarService — integração com Google Calendar API + Google Meet
 *
 * Token armazenado no banco (Integracao.configuracao.token) e sincronizado
 * no localStorage como cache. Re-autorização silenciosa quando expirar.
 */

const SCOPES = "https://www.googleapis.com/auth/calendar.events";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// ── Callbacks para persistência no banco (injetados pelo componente) ──
let _onTokenSaved = null;
let _getTokenFromDB = null;

export function setTokenPersistence({ onTokenSaved, getTokenFromDB }) {
  _onTokenSaved = onTokenSaved;
  _getTokenFromDB = getTokenFromDB;
}

// ── Token storage (localStorage como cache) ───────────────────
function getStoredToken() {
  try {
    const raw = localStorage.getItem("vendaflow_google_token");
    if (!raw) return null;
    const token = JSON.parse(raw);
    if (token.expires_at && Date.now() > token.expires_at) {
      localStorage.removeItem("vendaflow_google_token");
      return null;
    }
    return token;
  } catch { return null; }
}

function storeTokenLocally(tokenData) {
  const token = {
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  localStorage.setItem("vendaflow_google_token", JSON.stringify(token));
  return token;
}

async function storeToken(tokenData) {
  const token = storeTokenLocally(tokenData);
  if (_onTokenSaved) {
    try { await _onTokenSaved(token); } catch { /* não bloqueia */ }
  }
  return token;
}

export function clearToken() {
  localStorage.removeItem("vendaflow_google_token");
}

// ── Client ID storage ─────────────────────────────────────────
export function getClientId() {
  return localStorage.getItem("vendaflow_google_client_id") || "";
}

export function setClientId(clientId) {
  localStorage.setItem("vendaflow_google_client_id", clientId.trim());
}

// ── Calendar email storage ────────────────────────────────────
export function getCalendarEmail() {
  return localStorage.getItem("vendaflow_gcal_email") || "";
}

export function setCalendarEmail(email) {
  localStorage.setItem("vendaflow_gcal_email", email.trim());
}

// ── OAuth flow com popup ──────────────────────────────────────
function openOAuthPopup(prompt = "consent") {
  return new Promise((resolve, reject) => {
    const clientId = getClientId();
    if (!clientId) {
      reject(new Error("Client ID do Google não configurado."));
      return;
    }

    const redirectUri = `${window.location.origin}/google-oauth-callback`;
    const state = Math.random().toString(36).substring(2);
    sessionStorage.setItem("google_oauth_state", state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "token",
      scope: SCOPES,
      state,
      prompt,
      access_type: "online",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(authUrl, "google_oauth", `width=${width},height=${height},left=${left},top=${top}`);

    if (!popup) {
      reject(new Error("Popup bloqueado. Permita popups para este site."));
      return;
    }

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          const token = getStoredToken();
          if (token) resolve(token);
          else reject(new Error("Autorização cancelada."));
        }
      } catch { /* cross-origin */ }
    }, 500);

    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GOOGLE_OAUTH_CALLBACK") {
        window.removeEventListener("message", handler);
        clearInterval(interval);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          storeToken(event.data.token).then(resolve).catch(reject);
        }
        popup.close();
      }
    };
    window.addEventListener("message", handler);

    setTimeout(() => {
      clearInterval(interval);
      window.removeEventListener("message", handler);
      if (!popup.closed) popup.close();
      reject(new Error("Tempo de autorização expirado."));
    }, 300_000);
  });
}

async function silentReauth() {
  try {
    return await openOAuthPopup("none");
  } catch {
    return null;
  }
}

export async function startOAuthFlow() {
  return openOAuthPopup("consent");
}

// ── Obter token válido (cache → banco → silent → popup) ───────
export async function ensureConnected() {
  let token = getStoredToken();
  if (token) return token;

  if (_getTokenFromDB) {
    try {
      const dbToken = await _getTokenFromDB();
      if (dbToken?.access_token && dbToken.expires_at && Date.now() < dbToken.expires_at) {
        storeTokenLocally(dbToken);
        return dbToken;
      }
    } catch { /* segue */ }
  }

  token = await silentReauth();
  if (token) return token;

  return startOAuthFlow();
}

export function isConnected() {
  return !!getStoredToken();
}

export function isConfigured() {
  return !!getClientId();
}

export { getStoredToken };

// ── Criar evento no Google Calendar com Meet ──────────────────
export async function criarEventoComMeet({
  titulo,
  descricao,
  dataHoraInicio,
  duracaoMinutos = 60,
  participantes = [],
  timezone = "America/Sao_Paulo",
}) {
  const token = await ensureConnected();

  const inicio = new Date(dataHoraInicio);
  const fim = new Date(inicio.getTime() + duracaoMinutos * 60_000);

  const calEmail = getCalendarEmail();
  const allParticipants = [...participantes];
  if (calEmail && !allParticipants.find(p => p?.email === calEmail)) {
    allParticipants.push({ email: calEmail });
  }

  const evento = {
    summary: titulo,
    description: descricao,
    start: { dateTime: inicio.toISOString(), timeZone: timezone },
    end: { dateTime: fim.toISOString(), timeZone: timezone },
    attendees: allParticipants.filter(p => p?.email),
    conferenceData: {
      createRequest: {
        requestId: `vendaflow-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 30 },
        { method: "email", minutes: 60 },
      ],
    },
  };

  const response = await fetch(
    `${CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(evento),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) {
      clearToken();
      throw new Error("Token expirado. Reconecte sua conta Google.");
    }
    throw new Error(err.error?.message || `Erro ao criar evento (${response.status})`);
  }

  const data = await response.json();
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    meetLink: data.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri || "",
    hangoutLink: data.hangoutLink || "",
    status: data.status,
  };
}