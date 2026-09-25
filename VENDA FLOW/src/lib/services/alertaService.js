/**
 * alertaService — toda lógica de acesso a Alerta passa por aqui.
 */
import { base44 } from "@/api/base44Client";

const Alertas = () => base44.entities.Alerta;

export async function listarAlertasNaoResolvidos() {
  return Alertas().filter({ resolvido: false });
}

export async function criarAlerta(dados) {
  return Alertas().create(dados);
}

export async function notificarGestores(empresaId, vinculos, { titulo, mensagem, usuarioReferencia }) {
  const gestores = vinculos.filter(v => v.papel === "gestor" || v.papel === "admin");
  const emailsGestores = gestores.map(g => g.userEmail);
  if (emailsGestores.length === 0) return;
  return Alertas().create({
    empresaId,
    destinatarios: emailsGestores,
    tipo: "tarefa_concluida",
    titulo,
    mensagem,
    prioridade: "normal",
    resolvido: false,
    usuario_referencia: usuarioReferencia,
  });
}