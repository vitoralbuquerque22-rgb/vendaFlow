import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneCall, MessageCircle, Mail, Search, User, Building2, Clock, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Calendar, FileText, DollarSign, Instagram, Image as ImageIcon, Link as LinkIcon, File, ClipboardList, Lock, Loader2, AlertCircle } from "lucide-react";
import PerfilEmpresaSection from "./PerfilEmpresaSection";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import FormularioSPINModal from "@/components/produtos/FormularioSPINModal";
import { toast } from "sonner";
import { atualizarLead, liberarLockLead } from "@/lib/services/leadService";
import { listarProdutos, carregarMapaNomes } from "@/lib/services/equipeService";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

const tipoConfig = {
  ligacao: { icon: Phone, color: "bg-sky-500/20 text-sky-400 border-sky-500/30", label: "Ligação" },
  whatsapp: { icon: MessageCircle, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "WhatsApp" },
  email: { icon: Mail, color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "E-mail" },
  pesquisa: { icon: Search, color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Pesquisa" },
  enviar_contrato: { icon: FileText, color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Enviar Contrato" },
  recebimento: { icon: DollarSign, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Recebimento" },
  instagram: { icon: Instagram, color: "bg-pink-500/20 text-pink-400 border-pink-500/30", label: "Instagram" },
  reuniao: { icon: Calendar, color: "bg-violet-500/20 text-violet-400 border-violet-500/30", label: "Reunião" },
  case_sucesso: { icon: CheckCircle2, color: "bg-teal-500/20 text-teal-400 border-teal-500/30", label: "Case de Sucesso" },
};

export default function TaskCard({ tarefa, scripts, atividades, user, onExecutar, onConcluir, atrasada, onIniciarCadencia, telefonia, userProfile, expandedId, onExpandChange }) {
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    setExpanded(expandedId === tarefa.id);
  }, [expandedId, tarefa.id]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptsUsados, setScriptsUsados] = useState(new Set());
  const [spinModalAberto, setSpinModalAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [ligandoLocal, setLigandoLocal] = useState(false);

  const { empresaId } = useEmpresaAtual();
  const { data: mapaNomes = new Map() } = useQuery({
    queryKey: ["mapaNomes", empresaId],
    queryFn: () => carregarMapaNomes(empresaId),
    enabled: !!empresaId,
    staleTime: 120000,
  });
  const resolverNomeAgente = (email) => mapaNomes.get((email || '').toLowerCase()) || email?.split('@')[0] || '';

  const leadBloqueado   = tarefa.is_locked_for_call;
  const lockExpirado    = (() => {
    if (!tarefa.lock_at) return true;
    return (Date.now() - new Date(tarefa.lock_at).getTime()) > 5 * 60 * 1000;
  })();
  const bloqueadoPorOutro = leadBloqueado && !lockExpirado && tarefa.lock_agent_email && tarefa.lock_agent_email !== user?.email;
  const { nivel } = usePermissions();
  const isAdminOrGestor = nivel >= 4;

  useEffect(() => {
    if (!leadBloqueado || lockExpirado) return;
    const ms = 5 * 60 * 1000 - (Date.now() - new Date(tarefa.lock_at).getTime());
    if (ms <= 0) return;
    const timer = setTimeout(async () => {
      try {
        await atualizarLead(tarefa.lead_id, {
          is_locked_for_call: false,
          lock_agent_email: null,
          lock_at: null,
          call_session_id: null,
        });
      } catch {}
    }, ms);
    return () => clearTimeout(timer);
  }, [tarefa.lock_at, leadBloqueado, lockExpirado]);
  const euEstouLigando    = leadBloqueado && !lockExpirado && tarefa.lock_agent_email === user?.email;

  const { data: leadCompleto } = useQuery({
    queryKey: ["lead-completo", tarefa.lead_id],
    queryFn: async () => {
      const { buscarLeadPorId } = await import("@/lib/services/leadService");
      return buscarLeadPorId(tarefa.lead_id);
    },
    enabled: !!tarefa.lead_id && expanded,
  });
  
  const tipoCanon = (tarefa.tipo || "ligacao").toLowerCase().trim();

  const config = tipoConfig[tipoCanon] || tipoConfig.ligacao;
  const Icon = config.icon;

  const scriptsDoTipo = scripts?.filter(s => (s.tipo || "").toLowerCase().trim() === tipoCanon) || [];
  
  const tarefaEncerrada = tarefa.status === "encerrada_automaticamente";
  
  const getMotivoEncerramento = () => {
    switch (tarefa.motivo_encerramento) {
      case "sem_interesse":
        return "Encerrada: Lead sem interesse";
      case "desqualificacao":
        return "Encerrada: Lead desqualificado";
      case "conversao":
      case "reuniao_agendada":
        return "Encerrada: Reunião agendada (Conversão)";
      default:
        return "Encerrada automaticamente";
    }
  };

  useEffect(() => {
    if (atividades && tarefa) {
      const usados = new Set(
        atividades
          .filter(a => a.lead_id === tarefa.lead_id && a.tipo === tarefa.tipo && a.script_usado)
          .map(a => a.script_usado)
      );
      setScriptsUsados(usados);
    }
  }, [atividades, tarefa]);

  const handleWhatsAppClick = (script) => {
    const telefone = tarefa.lead_telefone?.replace(/\D/g, '');
    let mensagem = script.conteudo || '';
    
    if (script.links && script.links.length > 0) {
      mensagem += '\n\n🔗 Links:\n' + script.links.join('\n');
    }
    if (script.imagens && script.imagens.length > 0) {
      mensagem += '\n\n📷 ' + script.imagens.length + ' imagem(ns) anexada(s)';
    }
    if (script.arquivos && script.arquivos.length > 0) {
      mensagem += '\n\n📄 ' + script.arquivos.length + ' arquivo(s) anexado(s)';
    }
    
    const texto = encodeURIComponent(mensagem);
    window.open(`https://wa.me/55${telefone}?text=${texto}`, '_blank');
    
    if (script.imagens && script.imagens.length > 0) {
      setTimeout(() => {
        script.imagens.forEach((img, index) => {
          setTimeout(() => window.open(img, '_blank'), index * 500);
        });
      }, 1000);
    }
    if (script.arquivos && script.arquivos.length > 0) {
      setTimeout(() => {
        script.arquivos.forEach((arquivo, index) => {
          setTimeout(() => window.open(arquivo.url, '_blank'), index * 500);
        });
      }, script.imagens?.length ? 2000 : 1000);
    }
    
    setScriptsUsados(prev => new Set([...prev, script.nome]));
    setSelectedScript(script);
  };

  const handleRegistrarWhatsApp = () => {
    if (selectedScript) {
      onExecutar(tarefa, selectedScript.nome);
    }
  };

  const handleInstagramClick = (script) => {
    window.open('https://www.instagram.com/', '_blank');
    setScriptsUsados(prev => new Set([...prev, script.nome]));
    setSelectedScript(script);
  };

  const handleRegistrarInstagram = () => {
    if (selectedScript) {
      onExecutar(tarefa, selectedScript.nome);
    }
  };

  const handleIniciarLigacao3CPlus = async () => {
    if (!telefonia) {
      window.open(`tel:${tarefa.lead_telefone?.replace(/\D/g, '')}`, '_blank');
      return;
    }
    if (bloqueadoPorOutro) {
      toast.error(`Lead em atendimento por ${tarefa.lock_agent_email}`);
      return;
    }

    if (!telefonia.agenteCampanhaAtiva) {
      toast.error("Entre em uma campanha antes de ligar", {
        description: "Abra o Softphone e selecione uma campanha para começar a ligar.",
        duration: 5000,
      });
      return;
    }

    setLigandoLocal(true);
    try {
      if (!tarefa.lead_id) {
        toast.error('Lead não identificado', {
          description: 'Esta tarefa não tem lead vinculado. Identifique o lead antes de ligar.',
        });
        return;
      }
      if (!tarefa.lead_telefone || String(tarefa.lead_telefone).replace(/\D/g, '').length < 8) {
        toast.error('Telefone inválido', {
          description: 'Este lead não tem um telefone válido cadastrado.',
        });
        return;
      }
      // Usa apenas ligarAgoraLead — suporta click2call e enter+dial com fallback interno
      const resultado = await telefonia.ligarAgoraLead?.(tarefa.lead_id, tarefa.lead_nome);
      if (resultado?.sucesso) {
        setExpanded(false);
      } else {
        const erro = resultado?.erro || "Erro ao iniciar ligação";
        if (erro === "LEAD_LOCKED" || erro?.includes("bloqueado")) {
          toast.error("Lead já está em atendimento", {
            description: `Em atendimento por ${resultado?.agent_lock || 'outro agente'}. Aguarde ou force a liberação.`,
          });
        } else if (erro === "FALHA_API_3C") {
          const detalhe = resultado?.mensagem3C || resultado?.detalhe || "";
          const dica    = resultado?.dica || "";
          let mensagem  = "Falha na API do 3C Plus";
          try {
            const match = detalhe.match(/\{.*\}/s);
            if (match) {
              const obj = JSON.parse(match[0]);
              mensagem  = obj.detail || obj.message || obj.title || mensagem;
            } else if (detalhe) {
              mensagem = detalhe;
            }
          } catch {}
          toast.error("Erro ao iniciar ligação", {
            description: dica ? `${mensagem} — ${dica}` : mensagem,
          });
        } else if (erro === "TOKEN_NOT_FOUND") {
          toast.error("Token 3C Plus não configurado", {
            description: "Acesse seu Perfil e configure o Token 3C Plus na aba Telefonia.",
          });
        } else {
          toast.error("Erro ao iniciar ligação", { description: erro });
        }
      }
    } catch (e) {
      toast.error("Erro ao iniciar ligação", { description: e.message });
    } finally {
      setLigandoLocal(false);
    }
  };

  const handleLigacaoClick = (script) => {
    setSelectedScript(script);
    onExecutar(tarefa, script?.nome);
  };

  const abrirFormularioSPIN = async () => {
    if (!tarefa.produto_id) {
      toast.error("Nenhum produto vinculado a esta tarefa");
      return;
    }
    
    const produto = await listarProdutos(null, { apenasAtivos: false }).then(ps => ps.filter(p => p.id === tarefa.produto_id));
    if (!produto[0]?.manual?.perguntas_spin) {
      toast.error("Produto não possui perguntas SPIN cadastradas");
      return;
    }
    
    setProdutoSelecionado(produto[0]);
    setSpinModalAberto(true);
  };

  const salvarFormularioSPIN = async (dados) => {
    await base44.entities.FormularioSPIN.create({
      lead_id: tarefa.lead_id,
      lead_nome: tarefa.lead_nome,
      produto_id: tarefa.produto_id,
      produto_nome: tarefa.produto_nome,
      usuario_email: user.email,
      ...dados,
    });
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div 
          onClick={() => !tarefaEncerrada && onExpandChange?.(expanded ? null : tarefa.id)}
          className={cn(
            "rounded-2xl bg-slate-900/60 border border-slate-800/60 overflow-hidden transition-all duration-300 hover:border-slate-700/80 cursor-pointer",
            expanded && "border-blue-500/30 ring-1 ring-blue-500/20 shadow-lg shadow-blue-500/5",
            tarefaEncerrada && "opacity-50 cursor-default",
            atrasada && "border-rose-500/30 ring-1 ring-rose-500/20"
          )}>
        {atrasada && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-1.5 flex items-center gap-2">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">Atrasada</span>
          </div>
        )}
        {euEstouLigando && (
          <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-semibold text-sky-400">Em ligação</span>
            {telefonia?.cronometroFormatado && (
              <span className="text-xs font-mono text-sky-400 ml-auto">{telefonia.cronometroFormatado}</span>
            )}
          </div>
        )}
        <div className="p-4">
          {tarefaEncerrada && (
            <div className={cn(
              "mb-3 px-3 py-2 rounded-xl flex items-center gap-2 text-xs",
              tarefa.motivo_encerramento === "conversao" || tarefa.motivo_encerramento === "reuniao_agendada"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-slate-800/80 text-slate-500 border border-slate-700/50"
            )}>
              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">{getMotivoEncerramento()}</span>
            </div>
          )}
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn("p-2 rounded-xl border", config.color, tarefaEncerrada && "opacity-40")}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={cn("font-semibold text-white text-sm truncate", tarefaEncerrada && "line-through opacity-60")}>{tarefa.lead_nome || tarefa.lead_telefone || "Lead sem dados"}</h3>
                    {tarefa.dia_cadencia && (
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-800/80 border border-slate-700/50 rounded-full px-2 py-0.5">
                        Dia {tarefa.dia_cadencia}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-800/40 px-2 py-0.5 rounded border border-slate-700/30">
                    #{tarefa.lead_id?.slice(-6)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", config.color)}>
                    {config.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                  {tarefa.lead_empresa && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {tarefa.lead_empresa}
                    </span>
                  )}
                  {tarefa.lead_telefone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {tarefa.lead_telefone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {tarefa.produto_id && !tarefaEncerrada && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={abrirFormularioSPIN}
                  className="h-7 w-7 p-0 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg"
                  title="Formulário SPIN"
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                </Button>
              )}
              {!tarefaEncerrada && (
                <Button
                   size="sm"
                   variant="ghost"
                   onClick={() => onExpandChange?.(expanded ? null : tarefa.id)}
                   className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg"
                 >
                   {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                 </Button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && !tarefaEncerrada && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-slate-800/60"
            >
              <div className="p-4 space-y-3">
               {leadCompleto && (
                 <PerfilEmpresaSection lead={leadCompleto} readOnly />
               )}
               {tipoCanon === 'ligacao' && (
                 <div className="space-y-3">
                   {euEstouLigando ? (
                     <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                         <span className="text-xs text-sky-300 font-medium">
                           {telefonia?.callSession ? "Ligação em andamento..." : "Lead bloqueado (ligação encerrada?)"}
                         </span>
                       </div>
                       {(!telefonia?.callSession || isAdminOrGestor) && (
                         <button
                           onClick={async (e) => {
                             e.stopPropagation();
                             try {
                               await atualizarLead(tarefa.lead_id, {
                                 is_locked_for_call: false,
                                 lock_agent_email: null,
                                 lock_at: null,
                                 call_session_id: null,
                               });
                               toast.success("Lead liberado");
                               } catch {
                               toast.error("Erro ao liberar lock");
                             }
                           }}
                           className="text-[10px] text-rose-400 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg px-2 py-1 transition-all flex-shrink-0"
                         >
                           Forçar liberação
                         </button>
                       )}
                     </div>
                   ) : bloqueadoPorOutro && isAdminOrGestor ? (
                     <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-rose-400" />
                         <span className="text-xs text-rose-300 font-medium">
                           Em atendimento por {resolverNomeAgente(tarefa.lock_agent_email)}
                           </span>
                           </div>
                           <button
                           onClick={async (e) => {
                           e.stopPropagation();
                           try {
                             await atualizarLead(tarefa.lead_id, {
                               is_locked_for_call: false,
                               lock_agent_email: null,
                               call_session_id: null,
                               lock_at: null,
                             });
                             toast.success("Lead liberado");
                             } catch {
                             toast.error("Erro ao liberar lead");
                           }
                         }}
                         className="text-[10px] text-rose-400 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg px-2 py-1 transition-all flex-shrink-0"
                       >
                         Forçar liberação
                       </button>
                     </div>
                   ) : bloqueadoPorOutro ? (
                     <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                       <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-rose-400" />
                         <span className="text-xs text-rose-300 font-medium">
                           Em atendimento por {resolverNomeAgente(tarefa.lock_agent_email)}
                           </span>
                           </div>
                           {isAdminOrGestor && (
                         <button
                           onClick={async (e) => {
                             e.stopPropagation();
                             try {
                               await liberarLockLead(tarefa.lead_id);
                               toast.success("Lead liberado");
                             } catch {
                               toast.error("Erro ao liberar lead");
                             }
                           }}
                           className="text-[10px] text-rose-400 hover:text-white bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/30 rounded-lg px-2 py-1 transition-all flex-shrink-0"
                         >
                           Forçar liberação
                         </button>
                       )}
                     </div>
                   ) : (
                     <button
                       onClick={(e) => { e.stopPropagation(); handleIniciarLigacao3CPlus(); }}
                       disabled={
                         ligandoLocal ||
                         !!telefonia?.callSession ||
                         telefonia?.leadCallStatus === 'em_ligacao' ||
                         telefonia?.leadCallStatus === 'discando' ||
                         telefonia?.leadCallStatus === 'encerrado'
                       }
                       className={cn(
                         "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                         "text-sm font-semibold transition-all duration-200",
                         "text-white active:scale-[0.98]",
                         "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none",
                         (!!telefonia?.callSession || telefonia?.leadCallStatus === 'em_ligacao' || telefonia?.leadCallStatus === 'discando')
                           ? "bg-slate-600 cursor-not-allowed shadow-none"
                           : "bg-green-500 hover:bg-green-400 active:bg-green-600 shadow-md shadow-green-500/30 hover:shadow-lg hover:shadow-green-500/40",
                       )}
                     >
                       {ligandoLocal
                         ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando...</>
                         : (!!telefonia?.callSession && telefonia.callSession.lead_id === tarefa.lead_id)
                         ? <><PhoneCall className="w-4 h-4" /> Em ligação...</>
                         : !!telefonia?.callSession
                         ? <><PhoneCall className="w-4 h-4" /> Ocupado</>
                         : <><PhoneCall className="w-4 h-4" /> Ligar agora</>
                       }
                     </button>
                   )}

                   {scriptsDoTipo.length > 0 && (
                     <div>
                       <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Scripts</p>
                       <div className="space-y-2">
                         {scriptsDoTipo.map(script => (
                           <div
                             key={script.id}
                             className={cn(
                               "p-3 rounded-xl border transition-all cursor-pointer",
                               selectedScript?.id === script.id
                                 ? "bg-sky-500/10 border-sky-500/30"
                                 : "bg-slate-800/60 border-slate-700/50 hover:border-slate-600"
                             )}
                             onClick={() => setSelectedScript(script)}
                           >
                             <p className="font-medium text-white text-sm">{script.nome}</p>
                             <p className="text-slate-400 text-xs mt-1 line-clamp-2">{script.conteudo}</p>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {bloqueadoPorOutro && isAdminOrGestor ? (
                     <Button
                       onClick={async (e) => {
                         e.stopPropagation();
                         try {
                           await atualizarLead(tarefa.lead_id, {
                             is_locked_for_call: false,
                             lock_agent_email: null,
                             lock_at: null,
                             call_session_id: null,
                           });
                           toast.success("Lead desbloqueado com sucesso");
                         } catch (err) {
                           toast.error("Erro ao desbloquear lead: " + err.message);
                         }
                       }}
                       className="w-full bg-rose-600/80 hover:bg-rose-600 text-white border border-rose-500/40"
                     >
                       <Lock className="w-4 h-4 mr-2" />
                       Forçar desbloqueio do lead
                     </Button>
                   ) : !bloqueadoPorOutro ? (
                     <Button
                       onClick={() => handleLigacaoClick(selectedScript)}
                       variant="ghost"
                       className="w-full text-slate-500 hover:text-slate-300 border border-slate-800/60 hover:border-slate-700"
                     >
                       <CheckCircle2 className="w-4 h-4 mr-2" />
                       Registrar manualmente
                     </Button>
                   ) : null}
                 </div>
               )}

                {tipoCanon === 'whatsapp' && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Selecione uma mensagem:</p>
                    <div className="space-y-2">
                      {scriptsDoTipo.map(script => {
                        const jaUsado = scriptsUsados.has(script.nome);
                        return (
                          <div
                            key={script.id}
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              jaUsado && "opacity-50 bg-slate-800/50",
                              selectedScript?.id === script.id
                                ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30"
                                : "bg-slate-700/30 border-slate-600 hover:border-emerald-500/50"
                            )}
                            onClick={() => setSelectedScript(script)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-white text-sm">{script.nome}</p>
                              {jaUsado && (
                                <Badge variant="outline" className="text-xs bg-slate-700 text-slate-400">
                                  Já enviado
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{script.conteudo}</p>
                            {(script.imagens?.length > 0 || script.arquivos?.length > 0 || script.links?.length > 0) && (
                              <div className="flex gap-2 mt-2">
                                {script.imagens?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                                    <ImageIcon className="w-3 h-3" />
                                    {script.imagens.length}
                                  </div>
                                )}
                                {script.arquivos?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-red-400">
                                    <File className="w-3 h-3" />
                                    {script.arquivos.length}
                                  </div>
                                )}
                                {script.links?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-blue-400">
                                    <LinkIcon className="w-3 h-3" />
                                    {script.links.length}
                                  </div>
                                )}
                              </div>
                            )}
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsAppClick(script);
                              }}
                              className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Abrir WhatsApp
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleRegistrarWhatsApp}
                      disabled={!selectedScript}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Registrar Atividade
                    </Button>
                  </div>
                )}

                {tipoCanon === 'email' && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Modelos de e-mail:</p>
                    <div className="space-y-2">
                      {scriptsDoTipo.map(script => (
                        <div
                          key={script.id}
                          className="p-3 rounded-lg bg-slate-700/30 border border-slate-600"
                        >
                          <p className="font-medium text-white text-sm">{script.nome}</p>
                          <p className="text-slate-400 text-xs mt-1 line-clamp-3">{script.conteudo}</p>
                        </div>
                      ))}
                    </div>
                    <Button
                      onClick={() => onExecutar(tarefa)}
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Marcar e-mail como enviado
                    </Button>
                  </div>
                )}

                {tipoCanon === 'pesquisa' && (
                  <div>
                    <p className="text-sm text-slate-400 mb-3">Realize a pesquisa sobre o lead e registre suas descobertas.</p>
                    <Button
                      onClick={() => onExecutar(tarefa)}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Marcar pesquisa como concluída
                    </Button>
                  </div>
                )}

                {(tipoCanon === 'enviar_contrato' || tipoCanon === 'recebimento') && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Selecione a mensagem:</p>
                    <div className="space-y-2">
                      {scriptsDoTipo.map(script => {
                        const jaUsado = scriptsUsados.has(script.nome);
                        return (
                          <div
                            key={script.id}
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              jaUsado && "opacity-50 bg-slate-800/50",
                              selectedScript?.id === script.id
                                ? "bg-emerald-500/20 border-emerald-500/50 ring-2 ring-emerald-500/30"
                                : "bg-slate-700/30 border-slate-600 hover:border-emerald-500/50"
                            )}
                            onClick={() => setSelectedScript(script)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-white text-sm">{script.nome}</p>
                              {jaUsado && (
                                <Badge variant="outline" className="text-xs bg-slate-700 text-slate-400">
                                  Já enviado
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs mt-1 line-clamp-2">{script.conteudo}</p>
                            {(script.imagens?.length > 0 || script.arquivos?.length > 0 || script.links?.length > 0) && (
                              <div className="flex gap-2 mt-2">
                                {script.imagens?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                                    <ImageIcon className="w-3 h-3" />
                                    {script.imagens.length}
                                  </div>
                                )}
                                {script.arquivos?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-red-400">
                                    <File className="w-3 h-3" />
                                    {script.arquivos.length}
                                  </div>
                                )}
                                {script.links?.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-blue-400">
                                    <LinkIcon className="w-3 h-3" />
                                    {script.links.length}
                                  </div>
                                )}
                              </div>
                            )}
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsAppClick(script);
                              }}
                              className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Abrir WhatsApp
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleRegistrarWhatsApp}
                      disabled={!selectedScript}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Registrar Atividade
                    </Button>
                  </div>
                )}

                {tipoCanon === 'instagram' && (
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Mensagem Instagram:</p>
                    <div className="space-y-2">
                      {scriptsDoTipo.map(script => {
                        const jaUsado = scriptsUsados.has(script.nome);
                        return (
                          <div
                            key={script.id}
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              jaUsado && "opacity-50 bg-slate-800/50",
                              selectedScript?.id === script.id
                                ? "bg-pink-500/20 border-pink-500/50 ring-2 ring-pink-500/30"
                                : "bg-slate-700/30 border-slate-600 hover:border-pink-500/50"
                            )}
                            onClick={() => setSelectedScript(script)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-white text-sm">{script.nome}</p>
                              {jaUsado && (
                                <Badge variant="outline" className="text-xs bg-slate-700 text-slate-400">
                                  Já usado
                                </Badge>
                              )}
                            </div>
                            <p className="text-slate-400 text-xs mt-1">{script.conteudo}</p>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstagramClick(script);
                              }}
                              className="mt-2 bg-pink-600 hover:bg-pink-700"
                            >
                              <Instagram className="w-3 h-3 mr-1" />
                              Abrir Instagram
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      onClick={handleRegistrarInstagram}
                      disabled={!selectedScript}
                      className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Registrar Atividade
                    </Button>
                  </div>
                )}

                {tipoCanon === 'case_sucesso' && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 mb-2">Registre o case de sucesso com este lead.</p>
                    <Button
                      onClick={() => onExecutar(tarefa)}
                      className="w-full bg-teal-600 hover:bg-teal-700"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Registrar Case de Sucesso
                    </Button>
                  </div>
                )}

                {tipoCanon === 'reuniao' && !tarefa.observacao?.includes('Nenhuma cadência de Closer foi vinculada') && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400 mb-2">Realize a reunião com o lead e registre o resultado.</p>
                    <Button
                      onClick={() => onExecutar(tarefa)}
                      className="w-full bg-violet-600 hover:bg-violet-700"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Registrar Reunião Realizada
                    </Button>
                  </div>
                )}

                {tipoCanon === 'reuniao' && tarefa.observacao?.includes('Nenhuma cadência de Closer foi vinculada') && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                    <p className="text-sm text-amber-300 font-semibold">⚠️ Ação Necessária</p>
                    <p className="text-xs text-amber-200/80">
                      Esta reunião não possui uma cadência de Closer vinculada automaticamente. 
                      Você precisa aceitar e escolher uma cadência para continuar o processo.
                    </p>
                    <Button
                      onClick={() => onIniciarCadencia?.(tarefa)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      Aceitar e Escolher Cadência
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>

    <FormularioSPINModal
      open={spinModalAberto}
      onClose={() => {
        setSpinModalAberto(false);
        setProdutoSelecionado(null);
      }}
      produto={produtoSelecionado}
      lead={{ id: tarefa.lead_id, nome: tarefa.lead_nome }}
      onSalvar={salvarFormularioSPIN}
    />
  </>
  );
}