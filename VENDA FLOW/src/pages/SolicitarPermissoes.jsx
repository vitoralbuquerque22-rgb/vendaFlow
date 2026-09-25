import { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/components/hooks/usePermissions";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { listarVinculos, vinculosParaUsuarios } from "@/lib/services/equipeService";
import { toast } from "sonner";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Inbox, ListTodo, Plus, Ban, Eye, RefreshCw, Paperclip, X as XIcon,
  MessageSquare, Tag, Forward, Search, Filter, AlertTriangle, UserCheck
} from "lucide-react";

const TIPOS = [
  { value: "mudanca_role",       label: "Mudança de papel",       sla: 24,  destinos: ["admin","gestor","supervisor"], detalheLabel: "Papel desejado" },
  { value: "acesso_pagina",      label: "Acesso a página",        sla: 12,  destinos: ["admin","gestor","supervisor"], detalheLabel: "Página / funcionalidade" },
  { value: "transferencia_lead", label: "Transferência de lead",  sla: 4,   destinos: ["supervisor","gestor"],         detalheLabel: "Nome/ID do lead" },
  { value: "suporte_closer",     label: "Suporte de Closer",      sla: 2,   destinos: ["closer"],                      detalheLabel: "Contexto (lead/negociação)" },
  { value: "aprovacao_proposta", label: "Aprovação de proposta",  sla: 4,   destinos: ["supervisor","gestor"],         detalheLabel: "Lead / valor da proposta" },
  { value: "ferias_folga",       label: "Férias / Folga",         sla: 48,  destinos: ["gestor","admin"],              detalheLabel: "Período solicitado" },
  { value: "equipamento",        label: "Equipamento / Recurso",  sla: 72,  destinos: ["admin","gestor"],              detalheLabel: "Recurso solicitado" },
  { value: "outro",              label: "Outro",                  sla: 24,  destinos: ["admin","gestor","supervisor","closer","sdr"], detalheLabel: "Detalhe" },
];

const STATUS_CONFIG = {
  pending:   { label: "Pendente",   color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  approved:  { label: "Aprovado",   color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  rejected:  { label: "Rejeitado",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  cancelled: { label: "Cancelado",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
};

const TAG_COLORS = {
  "Urgente": { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  "Dúvida": { bg: "rgba(56,189,248,0.15)", color: "#38bdf8" },
  "Financeiro": { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
  "Análise": { bg: "rgba(168,85,247,0.15)", color: "#c084fc" },
  "Bloqueio": { bg: "rgba(249,115,22,0.15)", color: "#fbbf24" }
};
const PRESET_TAGS = Object.keys(TAG_COLORS);

function DashboardSLA({ solicitacoes = [] }) {
  const stats = useMemo(() => {
    let total = solicitacoes.length;
    let pendentes = 0;
    let aprovadas = 0;
    let vencidas = 0;
    let tempoTotalMinutos = 0;
    let respondidas = 0;
    let ranking = {};

    solicitacoes.forEach(s => {
      if (s.status === "pending") pendentes++;
      if (s.status === "approved") aprovadas++;

      const tipo = TIPOS.find(t => t.value === s.request_type) || { sla: 24 };
      const created = parseISO(s.created_date);
      const limitDate = new Date(created.getTime() + tipo.sla * 60 * 60 * 1000);
      
      if (s.status === "pending" && new Date() > limitDate) {
        vencidas++;
      } else if ((s.status === "approved" || s.status === "rejected") && s.closed_at) {
        if (new Date(s.closed_at) > limitDate) vencidas++;
      }

      if (s.response_time_minutes) {
        respondidas++;
        tempoTotalMinutos += s.response_time_minutes;
        if (s.target_email) {
          if (!ranking[s.target_email]) ranking[s.target_email] = { name: s.target_name, count: 0, totalTime: 0 };
          ranking[s.target_email].count++;
          ranking[s.target_email].totalTime += s.response_time_minutes;
        }
      }
    });

    const tempoMedio = respondidas > 0 ? Math.round(tempoTotalMinutos / respondidas) : 0;
    
    const rankingArr = Object.values(ranking).map(r => ({
      name: r.name,
      avg: Math.round(r.totalTime / r.count)
    })).sort((a,b) => a.avg - b.avg).slice(0, 3);

    return { total, pendentes, aprovadas, vencidas, tempoMedio, rankingArr };
  }, [solicitacoes]);

  const statCard = {
    background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.5)",
    borderRadius: 12, padding: 12, flex: 1, minWidth: 120
  };

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <div style={statCard}>
        <p style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total</p>
        <p style={{ fontSize: 24, color: "#e2e8f0", fontWeight: 800 }}>{stats.total}</p>
      </div>
      <div style={statCard}>
        <p style={{ fontSize: 11, color: "#f59e0b", textTransform: "uppercase", fontWeight: 700 }}>Pendentes</p>
        <p style={{ fontSize: 24, color: "#fde68a", fontWeight: 800 }}>{stats.pendentes}</p>
      </div>
      <div style={statCard}>
        <p style={{ fontSize: 11, color: "#10b981", textTransform: "uppercase", fontWeight: 700 }}>Aprovadas</p>
        <p style={{ fontSize: 24, color: "#a7f3d0", fontWeight: 800 }}>{stats.aprovadas}</p>
      </div>
      <div style={statCard}>
        <p style={{ fontSize: 11, color: "#ef4444", textTransform: "uppercase", fontWeight: 700 }}>Vencidas SLA</p>
        <p style={{ fontSize: 24, color: "#fca5a5", fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
          {stats.vencidas} {stats.vencidas > 0 && <AlertTriangle style={{ width: 16, height: 16 }} />}
        </p>
      </div>
      <div style={statCard}>
        <p style={{ fontSize: 11, color: "#8b5cf6", textTransform: "uppercase", fontWeight: 700 }}>Tempo Médio</p>
        <p style={{ fontSize: 24, color: "#e9d5ff", fontWeight: 800 }}>
          {stats.tempoMedio > 60 ? `${Math.floor(stats.tempoMedio/60)}h ${stats.tempoMedio%60}m` : `${stats.tempoMedio}m`}
        </p>
      </div>
      <div style={{ ...statCard, minWidth: 200, flex: 2 }}>
        <p style={{ fontSize: 11, color: "#38bdf8", textTransform: "uppercase", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <UserCheck style={{ width: 12, height: 12 }} /> Top Responsáveis
        </p>
        {stats.rankingArr.length === 0 ? (
          <p style={{ fontSize: 12, color: "#64748b" }}>Sem dados suficientes</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {stats.rankingArr.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#cbd5e1" }}>{i+1}. {r.name}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                  {r.avg > 60 ? `${Math.floor(r.avg/60)}h ${r.avg%60}m` : `${r.avg}m`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SlaChip({ createdDate, slaHours, status }) {
  if (status !== "pending") {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`,
        whiteSpace: "nowrap",
      }}>{cfg.label}</span>
    );
  }

  const created = parseISO(createdDate);
  const deadlineMinutes = slaHours * 60;
  const elapsedMinutes  = differenceInMinutes(new Date(), created);
  const remaining       = deadlineMinutes - elapsedMinutes;
  const pct             = Math.max(0, remaining / deadlineMinutes);

  let color = "#10b981";
  if (pct < 0.25) color = "#ef4444";
  else if (pct < 0.75) color = "#f59e0b";

  if (remaining <= 0) {
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
        color: "#ef4444", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
        whiteSpace: "nowrap",
        display: "inline-flex", alignItems: "center", gap: 3
      }}>
        <AlertTriangle style={{ width: 10, height: 10 }} /> Vencido
      </span>
    );
  }

  const horas = Math.floor(remaining / 60);
  const mins  = remaining % 60;
  const label = horas > 0 ? `${horas}h ${mins}m` : `${mins}m`;

  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
      color, background: `${color}18`, border: `1px solid ${color}35`,
      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center"
    }}>
      <Clock style={{ width: 10, height: 10, marginRight: 3 }} />
      {label}
    </span>
  );
}

function AnexoList({ urls }) {
  if (!urls?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {urls.map((url, i) => {
        const name = url.split("/").pop().split("?")[0] || `Anexo ${i + 1}`;
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
        return isImage ? (
          <a key={i} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={name} style={{ height: 56, borderRadius: 6, border: "1px solid rgba(51,65,85,0.6)", objectFit: "cover" }} />
          </a>
        ) : (
          <a key={i} href={url} target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", gap: 4, background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.25)", borderRadius: 6, padding: "3px 8px",
            color: "#a5b4fc", fontSize: 11, textDecoration: "none",
          }}>
            <Paperclip style={{ width: 10, height: 10 }} /> {name}
          </a>
        );
      })}
    </div>
  );
}

function UploadAnexos({ anexos, setAnexos, disabled }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of Array.from(files)) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      setAnexos(prev => [...prev, ...urls]);
    } catch {
      toast.error("Erro ao enviar anexo");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: anexos.length ? 6 : 0 }}>
        {anexos.map((url, i) => {
          const name = url.split("/").pop().split("?")[0] || `Anexo ${i + 1}`;
          const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
          return (
            <div key={i} style={{ position: "relative", display: "inline-flex" }}>
              {isImage ? (
                <img src={url} alt={name} style={{ height: 44, borderRadius: 6, border: "1px solid rgba(51,65,85,0.6)", objectFit: "cover" }} />
              ) : (
                <span style={{
                  display: "flex", alignItems: "center", gap: 4, background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.25)", borderRadius: 6, padding: "3px 8px",
                  color: "#a5b4fc", fontSize: 11,
                }}>
                  <Paperclip style={{ width: 10, height: 10 }} /> {name}
                </span>
              )}
              <button
                onClick={() => setAnexos(prev => prev.filter((_, idx) => idx !== i))}
                style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", border: "none", borderRadius: "50%", width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
              >
                <XIcon style={{ width: 8, height: 8, color: "#fff" }} />
              </button>
            </div>
          );
        })}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
      <button
        type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}
        style={{
          background: "rgba(51,65,85,0.4)", border: "1px dashed rgba(99,102,241,0.35)",
          borderRadius: 8, padding: "6px 12px", color: uploading ? "#475569" : "#818cf8",
          fontSize: 11, cursor: disabled || uploading ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <Paperclip style={{ width: 11, height: 11 }} />
        {uploading ? "Enviando..." : "Anexar arquivo / imagem"}
      </button>
    </div>
  );
}

function ActionUploader({ onConfirm, confirmLabel, confirmBg }) {
  const [anexos, setAnexos] = useState([]);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <UploadAnexos anexos={anexos} setAnexos={setAnexos} />
      </div>
      <button onClick={() => onConfirm(anexos)} style={{ background: confirmBg, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
        {confirmLabel}
      </button>
    </div>
  );
}

const ApproveUploader = ({ onConfirm }) => <ActionUploader onConfirm={onConfirm} confirmLabel="Confirmar Aprovação" confirmBg="#10b981" />;
const RejectUploader = ({ onConfirm }) => <ActionUploader onConfirm={onConfirm} confirmLabel="Confirmar Rejeição" confirmBg="#ef4444" />;

function CommentsSection({ solicitacao, user }) {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation({
    mutationFn: async ({ id, text }) => {
      const s = await base44.entities.PermissionChangeRequest.get(id);
      const comments = s.comments || [];
      comments.push({
        text,
        author_email: user.email,
        author_name: user.full_name || user.email,
        created_at: new Date().toISOString()
      });
      return base44.entities.PermissionChangeRequest.update(id, { comments });
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-minhas"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-para-mim"] });
      toast.success("Comentário adicionado");
    }
  });

  const comments = solicitacao.comments || [];

  return (
    <div style={{ marginTop: 12, background: "rgba(15,23,42,0.4)", borderRadius: 8, padding: 12, border: "1px solid rgba(51,65,85,0.4)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
        <MessageSquare style={{ width: 12, height: 12 }} /> Discussão
      </p>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
        {comments.length === 0 ? (
          <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic" }}>Nenhum comentário ainda.</p>
        ) : (
          comments.map((c, i) => (
            <div key={i} style={{ background: c.author_email === user.email ? "rgba(99,102,241,0.1)" : "rgba(51,65,85,0.3)", padding: "6px 10px", borderRadius: 8, alignSelf: c.author_email === user.email ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.author_email === user.email ? "#818cf8" : "#94a3b8" }}>{c.author_name}</span>
                <span style={{ fontSize: 9, color: "#64748b" }}>{format(parseISO(c.created_at), "dd/MM HH:mm")}</span>
              </div>
              <p style={{ fontSize: 12, color: "#e2e8f0" }}>{c.text}</p>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input 
          value={commentText} onChange={e => setCommentText(e.target.value)} 
          placeholder="Adicionar comentário..." 
          style={{ flex: 1, background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 6, padding: "6px 10px", color: "#e2e8f0", fontSize: 12, outline: "none" }} 
          onKeyDown={e => e.key === "Enter" && commentText.trim() && addCommentMutation.mutate({ id: solicitacao.id, text: commentText.trim() })}
        />
        <button 
          onClick={() => commentText.trim() && addCommentMutation.mutate({ id: solicitacao.id, text: commentText.trim() })}
          disabled={!commentText.trim() || addCommentMutation.isPending}
          style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, padding: "0 12px", color: "#818cf8", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center" }}
        >
          <Send style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );
}

function ForwardSection({ solicitacao, usuarios, onForward }) {
  const [fwdEmail, setFwdEmail] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 6, padding: "4px 10px", color: "#38bdf8", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
        <Forward style={{ width: 12, height: 12 }} /> Reencaminhar
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <select value={fwdEmail} onChange={e => setFwdEmail(e.target.value)} style={{ background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 6, padding: "4px 8px", color: "#e2e8f0", fontSize: 11, outline: "none", width: 140 }}>
        <option value="">Selecione...</option>
        {usuarios.filter(u => u.email !== solicitacao.target_email).map(u => (
          <option key={u.email} value={u.email}>{u.full_name} ({u.papel})</option>
        ))}
      </select>
      <button onClick={() => {
        if(fwdEmail) {
          const dest = usuarios.find(u => u.email === fwdEmail);
          onForward(solicitacao.id, fwdEmail, dest?.full_name || fwdEmail);
          setOpen(false);
        }
      }} style={{ background: "#38bdf8", border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
        OK
      </button>
      <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4 }}>
        <XIcon style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

function TagsSection({ solicitacao, onToggleTag }) {
  const tags = solicitacao.tags || [];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <Tag style={{ width: 12, height: 12, color: "#64748b" }} />
      {PRESET_TAGS.map(t => {
        const active = tags.includes(t);
        const color = TAG_COLORS[t];
        return (
          <button
            key={t}
            onClick={() => onToggleTag(solicitacao.id, t, !active)}
            style={{
              background: active ? color.bg : "transparent",
              border: `1px solid ${active ? color.color : "rgba(100,116,139,0.3)"}`,
              borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 600,
              color: active ? color.color : "#64748b", cursor: "pointer"
            }}
          >
            {t}
          </button>
        )
      })}
    </div>
  );
}

function LinhaSolicitacao({ s, isMinha, onCancelar, onAprovar, onRejeitar, onAtualizar, usuarios, user }) {
  const [expandida, setExpandida] = useState(false);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [rejeitando, setRejeitando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [obsAprovacao, setObsAprovacao] = useState("");
  const tipo = TIPOS.find(t => t.value === s.request_type) || { label: s.request_type, sla: 24 };

  const tags = s.tags || [];

  const cell = {
    fontSize: 12, color: "#94a3b8", padding: "8px 10px",
    borderBottom: "1px solid rgba(51,65,85,0.5)", verticalAlign: "top",
    whiteSpace: "nowrap",
  };

  return (
    <>
      <tr
        onClick={() => setExpandida(e => !e)}
        style={{ cursor: "pointer", background: expandida ? "rgba(99,102,241,0.05)" : "transparent" }}
        className="hover:bg-slate-800/40 transition-colors"
      >
        <td style={{ ...cell, color: "#e2e8f0", fontWeight: 600, maxWidth: 180, whiteSpace: "normal" }}>
          {tipo.label}
        </td>
        <td style={cell}>
          {isMinha
            ? (s.target_name || s.target_email || "—")
            : (s.requester_name || s.requester_email || "—")}
        </td>
        <td style={{ ...cell, maxWidth: 160, whiteSpace: "normal", overflow: "hidden", textOverflow: "ellipsis" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>{s.detail_extra || "—"}</span>
            {tags.length > 0 && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {tags.map(t => (
                  <span key={t} style={{ background: TAG_COLORS[t]?.bg, color: TAG_COLORS[t]?.color, fontSize: 9, padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </td>
        <td style={cell}>
          {s.created_date
            ? format(parseISO(s.created_date), "dd/MM HH:mm", { locale: ptBR })
            : "—"}
        </td>
        <td style={cell}>
          <SlaChip createdDate={s.created_date} slaHours={tipo.sla} status={s.status} />
        </td>
        <td style={{ ...cell, textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
            {isMinha && s.status === "pending" && (
              <button
                onClick={e => { e.stopPropagation(); onCancelar(s.id); }}
                title="Cancelar"
                style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 6, padding: "2px 8px", color: "#ef4444", fontSize: 11,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                }}
              >
                <Ban style={{ width: 10, height: 10 }} /> Cancelar
              </button>
            )}
            {!isMinha && s.status === "pending" && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setAprovando(a => !a); setRejeitando(false); setExpandida(true); }}
                  style={{
                    background: aprovando ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.12)",
                    border: `1px solid rgba(16,185,129,${aprovando ? "0.6" : "0.3"})`,
                    borderRadius: 6, padding: "2px 8px", color: "#10b981", fontSize: 11,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <CheckCircle2 style={{ width: 10, height: 10 }} /> Aprovar
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setRejeitando(r => !r); setAprovando(false); setExpandida(true); }}
                  style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 6, padding: "2px 8px", color: "#ef4444", fontSize: 11,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                  }}
                >
                  <XCircle style={{ width: 10, height: 10 }} /> Rejeitar
                </button>
              </>
            )}
            <Eye style={{ width: 13, height: 13, color: "#475569" }} />
            {expandida
              ? <ChevronUp style={{ width: 13, height: 13, color: "#475569" }} />
              : <ChevronDown style={{ width: 13, height: 13, color: "#475569" }} />}
          </div>
        </td>
      </tr>

      {expandida && (
        <tr style={{ background: "rgba(15,23,42,0.6)" }}>
          <td colSpan={6} style={{ padding: "16px 20px", borderBottom: "1px solid rgba(51,65,85,0.5)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }} onClick={e => e.stopPropagation()}>
              
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(51,65,85,0.4)", paddingBottom: 12, alignItems: "center" }}>
                <TagsSection 
                  solicitacao={s} 
                  onToggleTag={(id, tag, add) => {
                    const newTags = add ? [...tags, tag] : tags.filter(x => x !== tag);
                    onAtualizar(id, { tags: newTags });
                  }} 
                />
                {!isMinha && s.status === "pending" && (
                  <ForwardSection solicitacao={s} usuarios={usuarios} onForward={(id, newEmail, newName) => {
                    const history = s.forwarded_history || [];
                    history.push({ from_email: user.email, to_email: newEmail, date: new Date().toISOString() });
                    onAtualizar(id, { target_email: newEmail, target_name: newName, forwarded_history: history });
                    toast.success("Solicitação reencaminhada");
                  }} />
                )}
              </div>

              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Justificativa</p>
                  <p style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{s.justification || "—"}</p>
                  {s.attachments?.length > 0 && <AnexoList urls={s.attachments} />}
                </div>
                {s.response_note && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: 10, color: "#475569", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Observação da resposta</p>
                    <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{s.response_note}</p>
                    {s.response_attachments?.length > 0 && <AnexoList urls={s.response_attachments} />}
                  </div>
                )}
              </div>

              {aprovando && !isMinha && s.status === "pending" && (
                <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 10, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Aprovação</p>
                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <textarea
                      value={obsAprovacao} onChange={e => setObsAprovacao(e.target.value)}
                      placeholder="Observação (opcional)..."
                      style={{
                        width: "100%", background: "#0f172a", border: "1px solid rgba(16,185,129,0.25)",
                        borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 12, minHeight: 56, resize: "none", outline: "none", boxSizing: "border-box",
                      }}
                    />
                    <ApproveUploader onConfirm={(urls) => { onAprovar(s.id, obsAprovacao, urls, s.created_date); setAprovando(false); }} />
                  </div>
                </div>
              )}

              {rejeitando && !isMinha && s.status === "pending" && (
                <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 10, color: "#ef4444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Rejeição</p>
                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <textarea
                      value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)}
                      placeholder="Explique o motivo..."
                      style={{
                        width: "100%", background: "#0f172a", border: "1px solid rgba(239,68,68,0.3)",
                        borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 12, minHeight: 60, resize: "none", outline: "none", boxSizing: "border-box",
                      }}
                    />
                    <RejectUploader onConfirm={(urls) => { onRejeitar(s.id, motivoRejeicao, urls, s.created_date); setRejeitando(false); }} />
                  </div>
                </div>
              )}

              <CommentsSection solicitacao={s} user={user} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TabelaSolicitacoes({ rows, isMinha, onCancelar, onAprovar, onRejeitar, onAtualizar, usuarios, user }) {
  const thStyle = {
    fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase",
    letterSpacing: "0.07em", padding: "8px 10px", borderBottom: "1px solid rgba(51,65,85,0.7)",
    textAlign: "left", whiteSpace: "nowrap",
  };

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "#334155" }}>
        <ListTodo style={{ width: 36, height: 36, margin: "0 auto 8px", opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>Nenhuma solicitação</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>{isMinha ? "Para" : "De"}</th>
            <th style={thStyle}>Detalhe</th>
            <th style={thStyle}>Data</th>
            <th style={thStyle}>SLA / Status</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(s => (
            <LinhaSolicitacao
              key={s.id}
              s={s}
              isMinha={isMinha}
              onCancelar={onCancelar}
              onAprovar={onAprovar}
              onRejeitar={onRejeitar}
              onAtualizar={onAtualizar}
              usuarios={usuarios}
              user={user}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SolicitarPermissoes() {
  const { user } = usePermissions();
  const { empresaId } = useEmpresaAtual();
  const queryClient = useQueryClient();

  const [tipo, setTipo]               = useState("");
  const [paraEmail, setParaEmail]     = useState("");
  const [detalhe, setDetalhe]         = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [formAnexos, setFormAnexos]   = useState([]);
  const [enviando, setEnviando]       = useState(false);

  const [tabParaMim, setTabParaMim]   = useState("pendentes");
  const [busca, setBusca]             = useState("");
  const [filtroTag, setFiltroTag]     = useState("");

  const tipoObj = TIPOS.find(t => t.value === tipo);

  const { data: vinculos = [] } = useQuery({
    queryKey: ["vinculos-empresa", empresaId],
    queryFn: () => listarVinculos(empresaId),
    enabled: !!empresaId,
    staleTime: 60_000,
  });

  const usuarios = useMemo(() => vinculosParaUsuarios(vinculos), [vinculos]);

  const destinatarios = useMemo(() => {
    if (!tipoObj) return usuarios;
    return usuarios.filter(u =>
      u.email !== user?.email &&
      tipoObj.destinos.includes(u.papel)
    );
  }, [tipoObj, usuarios, user?.email]);

  const { data: minhas = [], refetch: refetchMinhas } = useQuery({
    queryKey: ["solicitacoes-minhas", user?.email],
    queryFn: () => base44.entities.PermissionChangeRequest.filter({ requester_email: user.email }),
    enabled: !!user?.email,
    refetchInterval: 30000,
    select: data => [...data].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
  });

  const { data: paraMim = [], refetch: refetchParaMim } = useQuery({
    queryKey: ["solicitacoes-para-mim", user?.email],
    queryFn: () => base44.entities.PermissionChangeRequest.filter({ target_email: user.email }),
    enabled: !!user?.email,
    refetchInterval: 30000,
    select: data => [...data].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
  });

  const allRequests = useMemo(() => {
    const map = new Map();
    minhas.forEach(r => map.set(r.id, r));
    paraMim.forEach(r => map.set(r.id, r));
    return Array.from(map.values());
  }, [minhas, paraMim]);

  const refetch = () => { refetchMinhas(); refetchParaMim(); };

  const prevPendentes = useRef(null);
  const pendentesParaMimCount = paraMim.filter(s => s.status === "pending").length;
  useEffect(() => {
    if (prevPendentes.current === null) {
      prevPendentes.current = pendentesParaMimCount;
      if (pendentesParaMimCount > 0) {
        toast.info(`Você tem ${pendentesParaMimCount} solicitaç${pendentesParaMimCount > 1 ? "ões pendentes" : "ão pendente"} aguardando sua resposta.`, { duration: 6000 });
      }
      return;
    }
    if (pendentesParaMimCount > prevPendentes.current) {
      toast.info("Nova solicitação recebida!", { duration: 5000 });
    }
    prevPendentes.current = pendentesParaMimCount;
  }, [pendentesParaMimCount]);

  const filtradasParaMim = useMemo(() => {
    return paraMim.filter(s => {
      if (tabParaMim === "pendentes" && s.status !== "pending") return false;
      if (busca) {
        const termo = busca.toLowerCase();
        const match = (s.title || "").toLowerCase().includes(termo) || 
                      (s.requester_name || "").toLowerCase().includes(termo) ||
                      (s.detail_extra || "").toLowerCase().includes(termo);
        if (!match) return false;
      }
      if (filtroTag && !(s.tags || []).includes(filtroTag)) return false;
      return true;
    });
  }, [paraMim, tabParaMim, busca, filtroTag]);

  const atualizar = (id, patch) =>
    base44.entities.PermissionChangeRequest.update(id, patch);

  const atualizarMutation = useMutation({
    mutationFn: ({ id, patch }) => atualizar(id, patch),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["solicitacoes-minhas"] }); queryClient.invalidateQueries({ queryKey: ["solicitacoes-para-mim"] }); },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => atualizar(id, { status: "cancelled", closed_at: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["solicitacoes-minhas"] }); toast.success("Solicitação cancelada"); },
    onError: () => toast.error("Erro ao cancelar"),
  });

  const aprovarMutation = useMutation({
    mutationFn: ({ id, obs, attachments, created_date }) => {
      const closed_at = new Date().toISOString();
      const response_time_minutes = differenceInMinutes(parseISO(closed_at), parseISO(created_date));
      return atualizar(id, {
        status: "approved",
        response_note: obs || null,
        response_attachments: attachments?.length ? attachments : null,
        updated_date: closed_at,
        closed_at,
        response_time_minutes
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["solicitacoes-para-mim"] }); toast.success("Solicitação aprovada"); },
    onError: () => toast.error("Erro ao aprovar"),
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ id, motivo, attachments, created_date }) => {
      const closed_at = new Date().toISOString();
      const response_time_minutes = differenceInMinutes(parseISO(closed_at), parseISO(created_date));
      return atualizar(id, {
        status: "rejected",
        response_note: motivo,
        response_attachments: attachments?.length ? attachments : null,
        updated_date: closed_at,
        closed_at,
        response_time_minutes
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["solicitacoes-para-mim"] }); toast.success("Solicitação rejeitada"); },
    onError: () => toast.error("Erro ao rejeitar"),
  });

  const handleEnviar = async () => {
    if (!tipo) { toast.error("Selecione o tipo de solicitação"); return; }
    if (!paraEmail) { toast.error("Selecione para quem enviar"); return; }
    if (!justificativa.trim()) { toast.error("Preencha a justificativa"); return; }

    const dest = usuarios.find(u => u.email === paraEmail);
    setEnviando(true);
    try {
      await base44.entities.PermissionChangeRequest.create({
        requester_email: user.email,
        requester_name:  user.full_name || user.email,
        target_email:    paraEmail,
        target_name:     dest?.full_name || paraEmail,
        request_type:    tipo,
        title:           tipoObj?.label || tipo,
        detail_extra:    detalhe.trim() || null,
        justification:   justificativa.trim(),
        attachments:     formAnexos.length ? formAnexos : null,
        status:          "pending",
        sla_hours:       tipoObj?.sla || 24,
        created_date:    new Date().toISOString(),
      });
      toast.success("Solicitação enviada!");
      setTipo(""); setParaEmail(""); setDetalhe(""); setJustificativa(""); setFormAnexos([]);
      queryClient.invalidateQueries({ queryKey: ["solicitacoes-minhas"] });
    } catch {
      toast.error("Erro ao enviar solicitação");
    } finally {
      setEnviando(false);
    }
  };

  const panel = {
    background: "rgba(13,20,40,0.95)",
    border: "1px solid rgba(51,65,85,0.6)",
    borderRadius: 16, overflow: "hidden",
  };

  const panelHeader = (cor = "#6366f1") => ({
    padding: "12px 16px",
    borderBottom: "1px solid rgba(51,65,85,0.5)",
    background: `linear-gradient(135deg, ${cor}0d, transparent)`,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  });

  const label = { fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 };
  const select = { width: "100%", background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", cursor: "pointer" };
  const textarea = { width: "100%", background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, resize: "vertical", minHeight: 90, outline: "none", fontFamily: "inherit" };

  return (
    <div style={{ padding: "8px 0", display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 8 }}>
            <ListTodo style={{ width: 22, height: 22, color: "#6366f1" }} />
            Solicitações (Fase 2)
          </h1>
          <p style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Gestão de chamados, comentários e SLAs de resposta</p>
        </div>
        <button
          onClick={refetch}
          style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 8, padding: "6px 12px", color: "#818cf8", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          <RefreshCw style={{ width: 12, height: 12 }} /> Atualizar
        </button>
      </div>

      <DashboardSLA solicitacoes={allRequests} />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
        <div style={panel}>
          <div style={panelHeader("#6366f1")}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", display: "flex", alignItems: "center", gap: 6 }}>
              <Plus style={{ width: 14, height: 14 }} /> Nova Solicitação
            </span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={label}>Tipo de solicitação *</label>
              <select value={tipo} onChange={e => { setTipo(e.target.value); setParaEmail(""); }} style={select}>
                <option value="">Selecione...</option>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {tipoObj && (
              <div>
                <label style={label}>Para quem *</label>
                {destinatarios.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>Nenhum usuário disponível para este tipo</p>
                ) : (
                  <select value={paraEmail} onChange={e => setParaEmail(e.target.value)} style={select}>
                    <option value="">Selecione...</option>
                    {destinatarios.map(u => (
                      <option key={u.email} value={u.email}>
                        {u.full_name} ({u.papel})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {tipoObj?.detalheLabel && (
              <div>
                <label style={label}>{tipoObj.detalheLabel}</label>
                <input
                  value={detalhe} onChange={e => setDetalhe(e.target.value)}
                  placeholder={tipoObj.detalheLabel + "..."}
                  style={{ ...select, padding: "8px 10px" }}
                />
              </div>
            )}
            <div>
              <label style={label}>Justificativa *</label>
              <textarea
                value={justificativa} onChange={e => setJustificativa(e.target.value)}
                placeholder="Explique o motivo da solicitação..."
                style={textarea}
              />
            </div>
            <div>
              <label style={label}>Anexos (opcional)</label>
              <UploadAnexos anexos={formAnexos} setAnexos={setFormAnexos} disabled={enviando} />
            </div>
            {tipoObj && (
              <div style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
                <Clock style={{ width: 12, height: 12, color: "#818cf8" }} />
                <span style={{ fontSize: 11, color: "#818cf8" }}>SLA: <strong>{tipoObj.sla}h</strong> para resposta</span>
              </div>
            )}
            <button
              onClick={handleEnviar} disabled={enviando}
              style={{
                background: enviando ? "#1e293b" : "linear-gradient(135deg, #6366f1, #4f46e5)",
                border: "none", borderRadius: 10, padding: "10px 0",
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: enviando ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                opacity: enviando ? 0.6 : 1,
              }}
            >
              <Send style={{ width: 14, height: 14 }} />
              {enviando ? "Enviando..." : "Enviar Solicitação"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={panel}>
            <div style={panelHeader("#f59e0b")}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", display: "flex", alignItems: "center", gap: 6 }}>
                  <Inbox style={{ width: 14, height: 14 }} />
                  Solicitações para Mim
                  {pendentesParaMimCount > 0 && (
                    <span style={{ background: "rgba(245,158,11,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700, color: "#fde68a" }}>
                      {pendentesParaMimCount} pendente{pendentesParaMimCount > 1 ? "s" : ""}
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", background: "rgba(15,23,42,0.8)", borderRadius: 8, padding: 2, border: "1px solid rgba(51,65,85,0.6)" }}>
                  <button onClick={() => setTabParaMim("pendentes")} style={{ background: tabParaMim === "pendentes" ? "#334155" : "transparent", color: tabParaMim === "pendentes" ? "#f8fafc" : "#94a3b8", border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Pendentes</button>
                  <button onClick={() => setTabParaMim("todas")} style={{ background: tabParaMim === "todas" ? "#334155" : "transparent", color: tabParaMim === "todas" ? "#f8fafc" : "#94a3b8", border: "none", borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Todas</button>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 6, padding: "2px 8px", width: 160 }}>
                  <Search style={{ width: 12, height: 12, color: "#64748b" }} />
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." style={{ background: "transparent", border: "none", color: "#e2e8f0", fontSize: 11, padding: "4px", width: "100%", outline: "none" }} />
                </div>
                <select value={filtroTag} onChange={e => setFiltroTag(e.target.value)} style={{ background: "#0f172a", border: "1px solid rgba(51,65,85,0.8)", borderRadius: 6, padding: "4px 8px", color: "#e2e8f0", fontSize: 11, outline: "none" }}>
                  <option value="">Todas as tags</option>
                  {PRESET_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: "0 0 4px" }}>
              <TabelaSolicitacoes
                rows={filtradasParaMim}
                isMinha={false}
                onAprovar={(id, obs, attachments, created) => aprovarMutation.mutate({ id, obs, attachments, created_date: created })}
                onRejeitar={(id, motivo, attachments, created) => rejeitarMutation.mutate({ id, motivo, attachments, created_date: created })}
                onAtualizar={(id, patch) => atualizarMutation.mutate({ id, patch })}
                usuarios={usuarios}
                user={user}
              />
            </div>
          </div>

          <div style={panel}>
            <div style={panelHeader("#6366f1")}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", display: "flex", alignItems: "center", gap: 6 }}>
                <ListTodo style={{ width: 14, height: 14 }} />
                Minhas Solicitações (Enviadas)
                {minhas.length > 0 && (
                  <span style={{ background: "rgba(99,102,241,0.25)", borderRadius: 99, padding: "1px 7px", fontSize: 10, fontWeight: 700, color: "#a5b4fc" }}>
                    {minhas.length}
                  </span>
                )}
              </span>
            </div>
            <div style={{ padding: "0 0 4px" }}>
              <TabelaSolicitacoes
                rows={minhas}
                isMinha={true}
                onCancelar={id => cancelarMutation.mutate(id)}
                onAtualizar={(id, patch) => atualizarMutation.mutate({ id, patch })}
                usuarios={usuarios}
                user={user}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}