/**
 * VendaFlow Extension — Background Service Worker (v1.2)
 * Novo: eventos RAMAL_REGISTERED / RAMAL_UNREGISTERED para o CRM
 * aguardar o registro do ramal em vez de usar tempo fixo.
 */

let extensionTabId = null;
let agentConfig = null;
let registrando = false;
let ramalRegistrado = false;

const REGISTRO_DELAY_MS = 2000; // margem p/ o SIP registrar após a página carregar

async function broadcastCRM(type) {
  try {
    // Abas do CRM = os mesmos endereços onde o content script é injetado (manifest.json)
    const crmUrls = chrome.runtime.getManifest().content_scripts[0].matches;
    const tabs = await chrome.tabs.query({ url: crmUrls });
    for (const t of tabs) {
      try { await chrome.tabs.sendMessage(t.id, { type }); } catch {}
    }
  } catch {}
}

function marcarRegistrado() {
  if (ramalRegistrado) return;
  ramalRegistrado = true;
  console.log('[VendaFlow Extension] ✅ Ramal registrado');
  broadcastCRM('RAMAL_REGISTERED');
}

function marcarNaoRegistrado() {
  if (!ramalRegistrado) return;
  ramalRegistrado = false;
  broadcastCRM('RAMAL_UNREGISTERED');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SET_AGENT_CONFIG') {
    agentConfig = msg.config;
    chrome.storage.local.set({ agentConfig: msg.config });
    registrarWebRTC();
    sendResponse({ ok: true });
  }

  if (msg.type === 'GET_STATUS') {
    sendResponse({ ok: true, config: agentConfig, tabId: extensionTabId, ativo: extensionTabId !== null, registered: ramalRegistrado });
  }

  if (msg.type === 'GET_RAMAL_STATUS') {
    sendResponse({ ok: true, registered: ramalRegistrado, tabId: extensionTabId });
  }

  if (msg.type === 'DISCONNECT') {
    desconectar();
    sendResponse({ ok: true });
  }

  return true;
});

// Quando a aba do ramal terminar de carregar → ramal registrado
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === extensionTabId && changeInfo.status === 'complete') {
    setTimeout(marcarRegistrado, REGISTRO_DELAY_MS);
  }
});

async function registrarWebRTC() {
  if (!agentConfig?.token || !agentConfig?.dominio) return;
  if (registrando) return;
  registrando = true;

  try {
    // Verificar se já existe aba pinada do 3C Plus
    const abasExistentes = await chrome.tabs.query({ pinned: true });
    const abaExtension = abasExistentes.filter(t => t.url?.includes(`${agentConfig.dominio}.3c.plus/extension`));

    if (abaExtension.length > 0) {
      extensionTabId = abaExtension[0].id;
      console.log('[VendaFlow Extension] Aba WebRTC já existe:', extensionTabId);

      // Fechar duplicatas
      for (let i = 1; i < abaExtension.length; i++) {
        try { await chrome.tabs.remove(abaExtension[i].id); } catch {}
      }

      // Se a aba já carregou, o ramal já está registrado
      if (abaExtension[0].status === 'complete') {
        marcarRegistrado();
      }
      registrando = false;
      return;
    }

    // Fechar aba anterior se existir
    if (extensionTabId) {
      try { await chrome.tabs.remove(extensionTabId); } catch {}
      extensionTabId = null;
    }

    marcarNaoRegistrado();

    const url = `https://${agentConfig.dominio}.3c.plus/extension?api_token=${agentConfig.token}&auto_answer=true`;

    await new Promise(r => setTimeout(r, 500));

    // Abrir ATIVA na primeira vez — necessário para o Chrome exibir o pedido de
    // permissão de microfone e não limitar (throttle) a página do ramal
    const tab = await chrome.tabs.create({ url, active: true });
    extensionTabId = tab.id;

    await new Promise(r => setTimeout(r, 300));
    try { await chrome.tabs.update(extensionTabId, { pinned: true }); } catch {}

    console.log('[VendaFlow Extension] WebRTC registrando na aba:', tab.id);
  } catch (e) {
    console.error('[VendaFlow Extension] Erro ao registrar WebRTC:', e.message);
  } finally {
    registrando = false;
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === extensionTabId) {
    extensionTabId = null;
    marcarNaoRegistrado();
    console.log('[VendaFlow Extension] Aba WebRTC fechada — reconectando em 5s...');
    setTimeout(() => registrarWebRTC(), 5000);
  }
});

function desconectar() {
  if (extensionTabId) {
    chrome.tabs.remove(extensionTabId).catch(() => {});
    extensionTabId = null;
  }
  agentConfig = null;
  marcarNaoRegistrado();
  chrome.storage.local.remove('agentConfig');
}

async function restaurar() {
  const result = await chrome.storage.local.get('agentConfig');
  if (result.agentConfig) {
    agentConfig = result.agentConfig;
    await registrarWebRTC();
  }
}

chrome.runtime.onStartup.addListener(restaurar);
chrome.runtime.onInstalled.addListener(restaurar);
