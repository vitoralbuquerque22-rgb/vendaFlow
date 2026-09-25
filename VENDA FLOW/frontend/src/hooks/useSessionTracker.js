import { useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

// Gera ou recupera um session_id único por aba/sessão
function getSessionId() {
  let sid = sessionStorage.getItem("vf_session_id");
  if (!sid) {
    sid = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem("vf_session_id", sid);
  }
  return sid;
}

export function useSessionTracker(currentPageName) {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const authed = await api.auth.isAuthenticated();
      if (!authed) return null;
      return api.auth.me();
    },
  });
  const { empresaId } = useEmpresaAtual();
  const sessionStartRef = useRef(Date.now());
  const pageStartRef = useRef(Date.now());
  const lastPageRef = useRef(null);
  const sessionId = getSessionId();

  const registrar = async (tipo_evento, extra = {}) => {
    if (!user?.email) return;
    try {
      await api.functions.invoke("registrarLogAcesso", {
        empresaId: empresaId || null,
        tipo_evento,
        session_id: sessionId,
        ...extra,
      });
    } catch {}
  };

  // Registra login (uma vez por sessão)
  useEffect(() => {
    if (!user?.email) return;
    const jaRegistrou = sessionStorage.getItem("vf_login_logged");
    if (!jaRegistrou) {
      sessionStorage.setItem("vf_login_logged", "1");
      registrar("login");
    }
  }, [user?.email]);

  // Registra troca de página
  useEffect(() => {
    if (!user?.email || !currentPageName) return;
    const prev = lastPageRef.current;

    if (prev && prev !== currentPageName) {
      const duracao = Math.round((Date.now() - pageStartRef.current) / 1000);
      registrar("pagina_visitada", { pagina: prev, duracao_segundos: duracao });
    }

    pageStartRef.current = Date.now();
    lastPageRef.current = currentPageName;
  }, [currentPageName, user?.email]);

  // Registra logout / saída da aba
  useEffect(() => {
    if (!user?.email) return;

    const handleUnload = () => {
      const duracao = Math.round((Date.now() - sessionStartRef.current) / 1000);
      // sendBeacon é mais confiável no unload
      const payload = JSON.stringify({
        empresaId: empresaId || null,
        tipo_evento: "logout",
        session_id: sessionId,
        duracao_segundos: duracao,
      });
      navigator.sendBeacon?.(`/api/functions/registrarLogAcesso`, payload);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [user?.email, empresaId]);
}