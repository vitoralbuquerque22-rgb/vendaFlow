/**
 * RamalWebRTC — registra o ramal WebRTC do agente no 3C Plus, dentro do próprio CRM, com JsSIP.
 *
 * Faz o mesmo que a página https://{dominio}.3c.plus/extension (e a antiga extensão do Chrome):
 * conecta em wss://vox-socket.3c.plus:4443, registra sip:{telephony_id}@{dominio}.3c.plus com a
 * senha SIP do agente e atende automaticamente as chamadas que o discador entrega ao ramal.
 * A diferença: as credenciais SIP vêm do nosso backend (comando get-ramal-webrtc, que usa o token
 * de serviço + X-Agent-Id). O navegador recebe só a senha SIP do próprio ramal — nunca um token.
 *
 * Protocolo de mensagens (o mesmo da extensão; ver hooks/useExtensaoChrome e hooks/useRamalStatus):
 *   CRM → Ramal: VENDAFLOW_PING                → VENDAFLOW_PONG
 *   CRM → Ramal: VENDAFLOW_SET_AGENT {config}  → registra o ramal ({ empresaId, dominio })
 *   CRM → Ramal: VENDAFLOW_GET_RAMAL_STATUS    → VENDAFLOW_RAMAL_STATUS { registered }
 *   Ramal → CRM: VENDAFLOW_RAMAL_REGISTERED / VENDAFLOW_RAMAL_UNREGISTERED
 *
 * Várias abas: só UMA aba registra o ramal (a "dona", escolhida pela Web Locks API). As outras
 * conversam com ela por BroadcastChannel. Se a aba dona fechar, a trava passa para outra aba aberta,
 * que registra o ramal de novo. O áudio da ligação toca na aba dona.
 */
import { useEffect, useRef, useState } from "react";
import JsSIP from "jssip";
import { api } from "@/api/client";

const LOCK_NAME = "vendaflow-ramal-webrtc";
const CHANNEL_NAME = "vendaflow-ramal-webrtc";
const MAX_TENTATIVAS_REGISTRO = 10;

function avisar(type, extra = {}) {
  window.postMessage({ type, ...extra }, "*");
}

function mesmaConfig(a, b) {
  return !!a && !!b && a.empresaId === b.empresaId && a.dominio === b.dominio;
}

async function buscarCredenciais(empresaId) {
  const resp = await api.functions.invoke("executarComando3CPlus", { empresaId, comando: "get-ramal-webrtc" });
  const ramal = resp?.data?.ramal;
  if (!ramal?.uri || !ramal?.senha) throw new Error("Credenciais do ramal não recebidas");
  return ramal;
}

export default function RamalWebRTC() {
  const [dona, setDona] = useState(false); // esta aba é a que registra o ramal?
  const [config, setConfig] = useState(null); // { empresaId, dominio }
  const configRef = useRef(null); // última configuração conhecida (mesmo sem ser dona)
  const donaRef = useRef(false);
  const registradoRef = useRef(false);
  const canalRef = useRef(null);
  const audioRef = useRef(null);

  // Atualiza o status do ramal nesta aba e, se for a dona, nas outras também
  const definirRegistrado = (valor, { propagar } = { propagar: true }) => {
    if (registradoRef.current === valor) return;
    registradoRef.current = valor;
    avisar(valor ? "VENDAFLOW_RAMAL_REGISTERED" : "VENDAFLOW_RAMAL_UNREGISTERED");
    if (propagar && donaRef.current) canalRef.current?.postMessage({ tipo: "status", registrado: valor });
  };

  const receberConfig = (nova) => {
    if (!nova?.empresaId || mesmaConfig(configRef.current, nova)) return;
    configRef.current = nova;
    if (donaRef.current) setConfig(nova);
  };

  // Disputa pela trava: quem conseguir vira a dona e segura até a aba fechar
  useEffect(() => {
    if (!navigator.locks) {
      donaRef.current = true;
      setDona(true);
      return;
    }
    let ativo = true;
    let liberar;
    const segurando = new Promise((resolve) => (liberar = resolve));
    navigator.locks
      .request(LOCK_NAME, () => {
        if (!ativo) return; // desmontou antes de ganhar a trava: devolve na hora
        donaRef.current = true;
        setDona(true);
        if (configRef.current) setConfig(configRef.current);
        return segurando;
      })
      .catch(() => {});
    return () => {
      ativo = false;
      // Deixou de ser a dona: avisa as outras abas antes de soltar a trava
      if (donaRef.current && registradoRef.current) canalRef.current?.postMessage({ tipo: "status", registrado: false });
      donaRef.current = false;
      liberar();
    };
  }, []);

  // Canal entre abas
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const canal = new BroadcastChannel(CHANNEL_NAME);
    canalRef.current = canal;

    canal.onmessage = ({ data }) => {
      if (data?.tipo === "config") receberConfig(data.config);
      if (data?.tipo === "status" && !donaRef.current) definirRegistrado(!!data.registrado, { propagar: false });
      if (data?.tipo === "pergunta" && donaRef.current) {
        canal.postMessage({ tipo: "status", registrado: registradoRef.current });
        if (configRef.current) canal.postMessage({ tipo: "config", config: configRef.current });
      }
    };
    // Aba nova pergunta à dona como está o ramal
    canal.postMessage({ tipo: "pergunta" });

    // Dona fechando: avisa as outras abas que o ramal caiu (outra assume a trava)
    const aoSair = () => {
      if (donaRef.current && registradoRef.current) canal.postMessage({ tipo: "status", registrado: false });
    };
    window.addEventListener("pagehide", aoSair);

    return () => {
      window.removeEventListener("pagehide", aoSair);
      canal.close();
      canalRef.current = null;
    };
  }, []);

  // Mensagens do próprio CRM (mesmo protocolo da extensão)
  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "VENDAFLOW_PING") avisar("VENDAFLOW_PONG");

      if (data.type === "VENDAFLOW_SET_AGENT") {
        const nova = { empresaId: data.config?.empresaId, dominio: data.config?.dominio ?? null };
        if (!nova.empresaId) return;
        const mudou = !mesmaConfig(configRef.current, nova);
        receberConfig(nova);
        if (mudou) canalRef.current?.postMessage({ tipo: "config", config: nova });
      }

      if (data.type === "VENDAFLOW_GET_RAMAL_STATUS") {
        avisar("VENDAFLOW_RAMAL_STATUS", { registered: registradoRef.current });
      }
    }

    window.addEventListener("message", onMessage);
    avisar("VENDAFLOW_EXTENSION_READY");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Registro SIP — só na aba dona, quando há configuração
  useEffect(() => {
    if (!dona || !config) return;
    let encerrado = false;
    let ua = null;
    let tentativas = 0;
    let timerTentativa = null;

    (async () => {
      try {
        const ramal = await buscarCredenciais(config.empresaId);
        if (encerrado) return;

        // Permissão de microfone antes de registrar (sem ela o 3C entregaria chamada muda)
        const microfone = await navigator.mediaDevices.getUserMedia({ audio: true });
        microfone.getTracks().forEach((t) => t.stop());
        if (encerrado) return;

        ua = new JsSIP.UA({
          sockets: [new JsSIP.WebSocketInterface(ramal.ws)],
          uri: ramal.uri,
          password: ramal.senha,
          register: true,
          register_expires: 30,
          session_timers: false,
          no_answer_timeout: 60,
        });

        ua.on("registered", () => {
          tentativas = 0;
          definirRegistrado(true);
        });
        ua.on("unregistered", () => definirRegistrado(false));
        ua.on("registrationFailed", (e) => {
          console.warn("[RamalWebRTC] registro falhou:", e?.cause);
          definirRegistrado(false);
          clearTimeout(timerTentativa);
          timerTentativa = setTimeout(() => {
            if (encerrado || !ua?.isConnected() || ua.isRegistered()) return;
            if (++tentativas <= MAX_TENTATIVAS_REGISTRO) ua.register();
          }, 5000);
        });
        ua.on("disconnected", () => definirRegistrado(false));

        // O discador entrega a ligação ao ramal: atender e tocar o áudio (como a página /extension)
        ua.on("newRTCSession", ({ session }) => {
          if (session.direction !== "incoming") return;
          session.on("peerconnection", ({ peerconnection }) => {
            peerconnection.addEventListener("track", (ev) => {
              if (audioRef.current && ev.streams?.[0]) {
                audioRef.current.srcObject = ev.streams[0];
                audioRef.current.play().catch(() => {});
              }
            });
          });
          session.answer({ mediaConstraints: { audio: true, video: false } });
        });

        ua.start();
      } catch (err) {
        console.error("[RamalWebRTC] não foi possível registrar o ramal:", err?.message || err);
        definirRegistrado(false);
      }
    })();

    return () => {
      encerrado = true;
      clearTimeout(timerTentativa);
      if (ua) {
        ua.removeAllListeners();
        ua.stop();
      }
      if (donaRef.current) definirRegistrado(false);
    };
  }, [dona, config]);

  return <audio ref={audioRef} autoPlay hidden />;
}
