import { useEffect, useState } from "react";

export default function GoogleOAuthCallback() {
  const [status, setStatus] = useState("processing");

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const access_token = params.get("access_token");
    const expires_in = params.get("expires_in");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      if (window.opener) {
        window.opener.postMessage(
          { type: "GOOGLE_OAUTH_CALLBACK", error },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 2000);
      return;
    }

    if (access_token) {
      setStatus("success");
      if (window.opener) {
        window.opener.postMessage(
          { type: "GOOGLE_OAUTH_CALLBACK", token: { access_token, expires_in } },
          window.location.origin
        );
      }
      setTimeout(() => window.close(), 2000);
    } else {
      setStatus("error");
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
      <div className="text-center space-y-3">
        {status === "success" && (
          <>
            <div className="text-5xl mb-4">✓</div>
            <p className="text-white text-lg font-semibold">Autorização concluída</p>
            <p className="text-slate-400 text-sm">Esta janela será fechada automaticamente...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl mb-4">✗</div>
            <p className="text-white text-lg font-semibold">Erro na autorização</p>
            <p className="text-slate-400 text-sm">Esta janela será fechada automaticamente...</p>
          </>
        )}
        {status === "processing" && (
          <>
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Processando autorização...</p>
          </>
        )}
      </div>
    </div>
  );
}