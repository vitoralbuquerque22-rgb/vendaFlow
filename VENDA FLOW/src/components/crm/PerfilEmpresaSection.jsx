import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Users, Star, Package } from "lucide-react";

/**
 * Seção reutilizável de Perfil da Empresa — aparece no LeadModal (criação/edição)
 * e no TaskCard (visualização expandida durante atendimento).
 *
 * Props:
 *  - formData / setFormData  → para modo edição (LeadModal)
 *  - lead                    → para modo leitura (TaskCard)
 *  - readOnly                → boolean, default false
 */
export default function PerfilEmpresaSection({ formData, setFormData, lead, readOnly = false }) {
  const { empresaId } = useEmpresaAtual();
  const data = readOnly ? lead : formData;

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-ativos", empresaId],
    queryFn: () => empresaId ? base44.entities.Produto.filter({ empresaId, ativo: true }) : [],
    enabled: !!empresaId,
  });

  const update = (field, value) => {
    if (!readOnly && setFormData) {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleProdutoComprado = (produtoId) => {
    if (readOnly) return;
    setFormData(prev => {
      const atual = prev.produtos_comprados || [];
      const novo = atual.includes(produtoId)
        ? atual.filter(id => id !== produtoId)
        : [...atual, produtoId];
      return { ...prev, produtos_comprados: novo, ja_cliente: novo.length > 0 };
    });
  };

  if (readOnly && !data) return null;

  // Modo leitura — exibe somente campos preenchidos
  if (readOnly) {
    const produtosComprados = produtos.filter(p => (data.produtos_comprados || []).includes(p.id));
    const hasData = data.cidade || data.estado || data.qtd_tecnicos || data.qtd_vendedores ||
      data.qtd_administrativo || (data.contratou_consultoria !== undefined && data.contratou_consultoria !== null) || data.tempo_seguindo ||
      data.qtd_unidades || data.tipo_rede || data.tem_socios || data.nome_socio || data.ja_cliente;

    if (!hasData) return null;

    return (
      <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-2">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Perfil da Empresa
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {(data.cidade || data.estado) && (
            <div className="flex items-center gap-1 text-slate-300">
              <MapPin className="w-3 h-3 text-slate-500" />
              {[data.cidade, data.estado].filter(Boolean).join(" - ")}
            </div>
          )}
          {data.qtd_unidades && (
            <div className="text-slate-400">🏢 <span className="text-white">{data.qtd_unidades}</span> unidade(s)</div>
          )}
          {data.tipo_rede && (
            <div className="text-slate-400">Rede: <span className="text-white capitalize">{data.tipo_rede.replace("_", " ")}</span></div>
          )}
          {data.qtd_tecnicos !== undefined && data.qtd_tecnicos !== null && data.qtd_tecnicos !== "" && (
            <div className="text-slate-400">🔧 <span className="text-white">{data.qtd_tecnicos}</span> técnico(s)</div>
          )}
          {data.qtd_vendedores !== undefined && data.qtd_vendedores !== null && data.qtd_vendedores !== "" && (
            <div className="text-slate-400">💼 <span className="text-white">{data.qtd_vendedores}</span> vendedor(es)</div>
          )}
          {data.qtd_administrativo !== undefined && data.qtd_administrativo !== null && data.qtd_administrativo !== "" && (
            <div className="text-slate-400">📋 <span className="text-white">{data.qtd_administrativo}</span> adm.</div>
          )}
          {data.contratou_consultoria !== null && data.contratou_consultoria !== undefined && (
            <div className="text-slate-400">Consultoria: <span className={data.contratou_consultoria ? "text-green-400" : "text-slate-400"}>{data.contratou_consultoria ? "Sim" : "Não"}</span></div>
          )}
          {data.tempo_seguindo && (
            <div className="text-slate-400">Nos segue há: <span className="text-white">{data.tempo_seguindo}</span></div>
          )}
          {data.tem_socios && data.nome_socio && (
            <div className="col-span-2 text-slate-400">
              🤝 Sócio: <span className="text-white">{data.nome_socio}</span>
              {data.telefone_socio && <span className="text-slate-500"> · {data.telefone_socio}</span>}
            </div>
          )}
        </div>
        {data.ja_cliente && produtosComprados.length > 0 && (
          <div className="pt-1.5 border-t border-blue-500/15">
            <p className="text-xs text-amber-400 font-semibold flex items-center gap-1 mb-1.5">
              <Star className="w-3 h-3" /> Já é cliente
            </p>
            <div className="flex flex-wrap gap-1">
              {produtosComprados.map(p => (
                <Badge key={p.id} className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                  {p.nome}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Modo edição
  return (
    <div className="space-y-4 pt-4 border-t border-slate-700/60">
      <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-400" />
        Perfil da Empresa <span className="text-xs font-normal text-slate-500">(opcional)</span>
      </p>

      {/* Grid 4 colunas — Localização e Unidades */}
      <div className="grid grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Cidade</Label>
          <Input
            value={data.cidade || ""}
            onChange={e => update("cidade", e.target.value)}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="Ex: São Paulo"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Estado (UF)</Label>
          <Input
            value={data.estado || ""}
            onChange={e => update("estado", e.target.value.toUpperCase().slice(0, 2))}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="SP"
            maxLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Nº de unidades</Label>
          <Input
            type="number"
            min="1"
            value={data.qtd_unidades ?? ""}
            onChange={e => update("qtd_unidades", e.target.value === "" ? null : Number(e.target.value))}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="1"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Tipo de rede</Label>
          <Select
            value={data.tipo_rede || ""}
            onValueChange={v => update("tipo_rede", v)}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-sm">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="independente">Independente</SelectItem>
              <SelectItem value="franquia">Franquia</SelectItem>
              <SelectItem value="rede_propria">Rede Própria</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid 3 colunas — Equipe */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Técnicos no pátio</Label>
          <Input
            type="number"
            min="0"
            value={data.qtd_tecnicos ?? ""}
            onChange={e => update("qtd_tecnicos", e.target.value === "" ? null : Number(e.target.value))}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Vendedores</Label>
          <Input
            type="number"
            min="0"
            value={data.qtd_vendedores ?? ""}
            onChange={e => update("qtd_vendedores", e.target.value === "" ? null : Number(e.target.value))}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Administrativo</Label>
          <Input
            type="number"
            min="0"
            value={data.qtd_administrativo ?? ""}
            onChange={e => update("qtd_administrativo", e.target.value === "" ? null : Number(e.target.value))}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="0"
          />
        </div>
      </div>

      {/* Grid 2 colunas — Consultoria e Relacionamento */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Já contratou consultoria?</Label>
          <Select
            value={data.contratou_consultoria === true ? "sim" : data.contratou_consultoria === false ? "nao" : ""}
            onValueChange={v => update("contratou_consultoria", v === "sim" ? true : v === "nao" ? false : null)}
          >
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-8 text-sm">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-slate-400 text-xs">Há quanto tempo nos segue?</Label>
          <Input
            value={data.tempo_seguindo || ""}
            onChange={e => update("tempo_seguindo", e.target.value)}
            className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
            placeholder="Ex: 6 meses, 2 anos"
          />
        </div>
      </div>

      {/* Sócio — 2 colunas quando expandido */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => update("tem_socios", !data.tem_socios)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all duration-200"
        >
          <span className="text-sm font-semibold text-emerald-600">Tem sócios?</span>
          <svg className={`w-4 h-4 text-emerald-600 transition-transform ${data.tem_socios ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
        {data.tem_socios && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Nome do sócio</Label>
              <Input
                value={data.nome_socio || ""}
                onChange={e => update("nome_socio", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Telefone do sócio</Label>
              <Input
                value={data.telefone_socio || ""}
                onChange={e => update("telefone_socio", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        )}
      </div>

      {/* Já é cliente */}
      <div className="space-y-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ja_cliente"
            checked={!!data.ja_cliente}
            onChange={e => {
              update("ja_cliente", e.target.checked);
              if (!e.target.checked) update("produtos_comprados", []);
            }}
            className="rounded border-slate-600"
          />
          <Label htmlFor="ja_cliente" className="text-amber-300 text-xs cursor-pointer flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" />
            Já é cliente (já comprou algum produto)
          </Label>
        </div>

        {data.ja_cliente && produtos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-slate-400 text-xs flex items-center gap-1">
              <Package className="w-3 h-3" />
              Quais produtos já comprou?
            </Label>
            <div className="flex flex-wrap gap-2">
              {produtos.map(p => {
                const selecionado = (data.produtos_comprados || []).includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProdutoComprado(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                      selecionado
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {selecionado ? "✓ " : ""}{p.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}