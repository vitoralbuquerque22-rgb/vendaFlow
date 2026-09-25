async function atualizarStatus() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

    const statusEl = document.getElementById('status');
    const infoEl   = document.getElementById('info');
    const tokenEl  = document.getElementById('token-info');
    const btnDesc  = document.getElementById('btn-desconectar');

    if (resp?.ativo && resp?.config) {
      statusEl.className = 'status ativo';
      statusEl.innerHTML = '<div class="dot verde"></div><span>WebRTC ativo — ramal registrado</span>';
      infoEl.textContent = 'Agente conectado. O softphone está ativo em background.';
      tokenEl.style.display = 'block';
      tokenEl.textContent = `Domínio: ${resp.config.dominio}.3c.plus`;
      btnDesc.style.display = 'block';
    } else {
      statusEl.className = 'status inativo';
      statusEl.innerHTML = '<div class="dot cinza"></div><span>WebRTC desconectado</span>';
      infoEl.textContent = 'Abra o VendaFlow CRM e entre em uma campanha para ativar.';
      tokenEl.style.display = 'none';
      btnDesc.style.display = 'none';
    }
  } catch (e) {
    console.warn('[VendaFlow Popup] erro ao obter status:', e.message);
  }
}

async function desconectar() {
  try {
    await chrome.runtime.sendMessage({ type: 'DISCONNECT' });
    await atualizarStatus();
  } catch (e) {
    console.warn('[VendaFlow Popup] erro ao desconectar:', e.message);
  }
}

document.getElementById('btn-desconectar').addEventListener('click', desconectar);
atualizarStatus();
