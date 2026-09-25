import { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Download, FileSpreadsheet, Loader2, Filter, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const COLUNAS_DISPONIVEIS = [
  { key: "nome", label: "Nome" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "empresa", label: "Empresa" },
  { key: "cargo", label: "Cargo" },
  { key: "status", label: "Status" },
  { key: "origem", label: "Origem" },
  { key: "campanha", label: "Campanha" },
  { key: "sdr_responsavel", label: "SDR Responsável" },
  { key: "closer_responsavel", label: "Closer Responsável" },
  { key: "equipe", label: "Equipe" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "ddd", label: "DDD" },
  { key: "instagram", label: "Instagram" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "created_date", label: "Data de Cadastro" },
  { key: "data_reuniao", label: "Data da Reunião" },
  { key: "valor_potencial", label: "Valor Potencial" },
  { key: "observacoes", label: "Observações" },
];

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "em_cadencia", label: "Em Cadência" },
  { value: "respondeu", label: "Respondeu" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "reuniao_realizada", label: "Reunião Realizada" },
  { value: "qualificado", label: "Qualificado" },
  { value: "desqualificado", label: "Desqualificado" },
  { value: "sem_interesse", label: "Sem Interesse" },
];

const ORIGEM_OPTIONS = [
  { value: "trafego_pago", label: "Tráfego Pago" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram_feed", label: "Instagram Feed" },
  { value: "instagram_story", label: "Instagram Story" },
  { value: "instagram", label: "Instagram" },
  { value: "many_chat", label: "ManyChat" },
  { value: "email", label: "E-mail" },
  { value: "campanha_whats", label: "Campanha WhatsApp" },
  { value: "organico", label: "Orgânico" },
  { value: "evento", label: "Evento" },
  { value: "lista_fria", label: "Lista Fria" },
  { value: "typeform", label: "Typeform" },
  { value: "wordpress", label: "WordPress" },
  { value: "outro", label: "Outro" },
];

function extrairDDD(telefone) {
  if (!telefone) return "";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length >= 2) return digits.substring(0, 2);
  return "";
}

function formatarValor(lead, key) {
  if (key === "ddd") return extrairDDD(lead.telefone);
  if (key === "created_date" || key === "data_reuniao") {
    const val = lead[key];
    if (!val) return "";
    try { return format(new Date(val), "dd/MM/yyyy", { locale: ptBR }); } catch { return val; }
  }
  if (key === "status") return (lead[key] || "").replaceAll("_", " ");
  if (key === "origem") return (lead[key] || "").replaceAll("_", " ");
  return lead[key] ?? "";
}

export default function ExportarLeadsModal({ open, onClose, empresaId, users = [] }) {
  const [filtros, setFiltros] = useState({
    status: "todos",
    origem: "todas",
    sdrEmail: "todos",
    closerEmail: "todos",
    dataInicio: "",
    dataFim: "",
    ddd: "",
    equipe: "",
  });
  const [colunasAtivas, setColunasAtivas] = useState(
    COLUNAS_DISPONIVEIS.slice(0, 8).map(c => c.key)
  );
  const [carregando, setCarregando] = useState(false);
  const [preview, setPreview] = useState(null); // { total, amostra }

  if (!open) return null;

  const toggleColuna = (key) => {
    setColunasAtivas(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selecionarTodas = () => setColunasAtivas(COLUNAS_DISPONIVEIS.map(c => c.key));
  const deselecionarTodas = () => setColunasAtivas([]);

  const contarFiltrosAtivos = () => {
    let count = 0;
    if (filtros.status !== "todos") count++;
    if (filtros.origem !== "todas") count++;
    if (filtros.sdrEmail !== "todos") count++;
    if (filtros.closerEmail !== "todos") count++;
    if (filtros.dataInicio) count++;
    if (filtros.dataFim) count++;
    if (filtros.ddd) count++;
    if (filtros.equipe) count++;
    return count;
  };

  const buscarLeads = async () => {
    setCarregando(true);
    try {
      // Busca todos os leads com os filtros aplicados (sem paginação)
      const res = await api.functions.invoke("buscarLeadsPaginados", {
        empresaId,
        pagina: 1,
        itensPorPagina: 9999,
        busca: "",
        status: filtros.status !== "todos" ? filtros.status : "",
        origem: filtros.origem !== "todas" ? filtros.origem : "",
        sdrEmail: filtros.sdrEmail !== "todos" ? filtros.sdrEmail : "",
        closerEmail: filtros.closerEmail !== "todos" ? filtros.closerEmail : "",
        dataInicio: filtros.dataInicio || "",
        dataFim: filtros.dataFim || "",
        ordenacaoCampo: "created_date",
        ordenacaoDirecao: "desc",
        apenasDoSDR: false,
      });

      let leads = res.data?.leads ?? [];

      // Filtros client-side extras
      if (filtros.ddd) {
        leads = leads.filter(l => extrairDDD(l.telefone) === filtros.ddd.replace(/\D/g, "").slice(0, 2));
      }
      if (filtros.equipe) {
        leads = leads.filter(l => l.equipe?.toLowerCase().includes(filtros.equipe.toLowerCase()));
      }

      return leads;
    } finally {
      setCarregando(false);
    }
  };

  const handlePreview = async () => {
    const leads = await buscarLeads();
    setPreview({ total: leads.length, amostra: leads.slice(0, 3) });
  };

  const handleExportar = async () => {
    const leads = await buscarLeads();
    if (leads.length === 0) {
      toast.error("Nenhum lead encontrado com os filtros selecionados.");
      return;
    }

    const colunasOrdenadas = COLUNAS_DISPONIVEIS.filter(c => colunasAtivas.includes(c.key));
    const headers = colunasOrdenadas.map(c => c.label);
    const rows = leads.map(lead => colunasOrdenadas.map(c => formatarValor(lead, c.key)));

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const bom = "\uFEFF"; // UTF-8 BOM para Excel
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    link.click();

    toast.success(`${leads.length} leads exportados com sucesso!`);
    onClose();
  };

  const filtrosAtivos = contarFiltrosAtivos();

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Exportar Leads</h2>
              <p className="text-slate-400 text-sm">Configure os filtros e colunas do arquivo</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Filtros */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-white">Filtros</h3>
              {filtrosAtivos > 0 && (
                <Badge className="bg-blue-500/20 text-blue-400 text-xs">{filtrosAtivos} ativo{filtrosAtivos > 1 ? "s" : ""}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Status</Label>
                <Select value={filtros.status} onValueChange={v => setFiltros(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Origem</Label>
                <Select value={filtros.origem} onValueChange={v => setFiltros(p => ({ ...p, origem: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todas">Todas as origens</SelectItem>
                    {ORIGEM_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">SDR Responsável</Label>
                <Select value={filtros.sdrEmail} onValueChange={v => setFiltros(p => ({ ...p, sdrEmail: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos os SDRs</SelectItem>
                    {users.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Closer Responsável</Label>
                <Select value={filtros.closerEmail} onValueChange={v => setFiltros(p => ({ ...p, closerEmail: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="todos">Todos os Closers</SelectItem>
                    {users.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Data de início (cadastro)</Label>
                <Input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={e => setFiltros(p => ({ ...p, dataInicio: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Data de fim (cadastro)</Label>
                <Input
                  type="date"
                  value={filtros.dataFim}
                  onChange={e => setFiltros(p => ({ ...p, dataFim: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">DDD (ex: 44, 11)</Label>
                <Input
                  placeholder="Ex: 44"
                  value={filtros.ddd}
                  onChange={e => setFiltros(p => ({ ...p, ddd: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                  maxLength={2}
                />
              </div>

              <div>
                <Label className="text-xs text-slate-400 mb-1 block">Equipe</Label>
                <Input
                  placeholder="Nome da equipe"
                  value={filtros.equipe}
                  onChange={e => setFiltros(p => ({ ...p, equipe: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Colunas */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Colunas do arquivo</h3>
              <div className="flex gap-2">
                <button onClick={selecionarTodas} className="text-xs text-blue-400 hover:text-blue-300">Todas</button>
                <span className="text-slate-600">·</span>
                <button onClick={deselecionarTodas} className="text-xs text-slate-400 hover:text-slate-300">Nenhuma</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {COLUNAS_DISPONIVEIS.map(col => {
                const ativo = colunasAtivas.includes(col.key);
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleColuna(col.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left ${
                      ativo
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 flex-shrink-0 ${ativo ? "text-emerald-400" : "text-slate-600"}`} />
                    <span className="truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-2">{colunasAtivas.length} coluna{colunasAtivas.length !== 1 ? "s" : ""} selecionada{colunasAtivas.length !== 1 ? "s" : ""}</p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-white">{preview.total} leads encontrados</span>
              </div>
              {preview.amostra.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 mb-2">Prévia dos primeiros registros:</p>
                  {preview.amostra.map((l, i) => (
                    <div key={i} className="text-xs text-slate-300 flex gap-3">
                      <span className="font-medium">{l.nome}</span>
                      <span className="text-slate-500">{l.telefone}</span>
                      <span className="text-slate-500">{l.status?.replaceAll("_", " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-700">
          <Button
            variant="ghost"
            onClick={handlePreview}
            disabled={carregando}
            className="text-slate-400 hover:text-white"
          >
            {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
            Pré-visualizar
          </Button>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button
              onClick={handleExportar}
              disabled={carregando || colunasAtivas.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {carregando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Exportar CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}