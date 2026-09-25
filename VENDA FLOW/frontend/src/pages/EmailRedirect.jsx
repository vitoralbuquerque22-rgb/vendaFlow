import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EmailRedirect() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const processarClique = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const envio_id = urlParams.get("envio_id");
        const lead_id = urlParams.get("lead_id");
        const destino = urlParams.get("destino");

        if (!envio_id || !destino) {
          setStatus("error");
          return;
        }

        // Registrar o clique via função backend
        await api.functions.invoke("trackEmailClick", {
          envio_id,
          lead_id,
        });

        setStatus("success");

        // Redirecionar após 1 segundo
        setTimeout(() => {
          window.location.href = destino;
        }, 1000);
      } catch (error) {
        console.error("Erro ao processar clique:", error);
        setStatus("error");
      }
    };

    processarClique();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-800 max-w-md w-full">
        <CardContent className="py-12 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Processando...</h2>
              <p className="text-slate-400">Você será redirecionado em instantes</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Redirecionando...</h2>
              <p className="text-slate-400">Aguarde um momento</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Erro</h2>
              <p className="text-slate-400">Link inválido ou expirado</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}