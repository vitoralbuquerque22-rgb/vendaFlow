import { useState } from "react";
import { ChevronDown, Building2, Users, Heart, MapPin, Star, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useEmpresaAtual } from "@/components/hooks/useEmpresaAtual";

/**
 * PerfilAccordion — 3 seções distintas:
 *  1. Estrutura   → localização, unidades, tipo de rede
 *  2. Equipe      → técnicos, vendedores, administrativo, sócios
 *  3. Relacionamento → consultoria prévia, tempo seguindo, já é cliente
 */
export default function PerfilAccordion({ formData, setFormData }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const { empresaId } = useEmpresaAtual();

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-ativos", empresaId],
    queryFn: () => empresaId ? api.entities.Produto.filter({ empresaId, ativo: true }) : [],
    enabled: !!empresaId,
  });

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const toggleProduto = (produtoId) => {
    setFormData(prev => {
      const atual = prev.produtos_comprados || [];
      const novo = atual.includes(produtoId) ? atual.filter(id => id !== produtoId) : [...atual, produtoId];
      return { ...prev, produtos_comprados: novo, ja_cliente: novo.length > 0 };
    });
  };

  const sections = [
    {
      id: "estrutura",
      label: "Estrutura da Empresa",
      icon: Building2,
      description: "Localização, unidades e tipo de rede",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs flex items-center gap-1"><MapPin className="w-3 h-3" /> Cidade</Label>
              <Input
                value={formData.cidade || ""}
                onChange={e => update("cidade", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="Ex: São Paulo"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Estado (UF)</Label>
              <Input
                value={formData.estado || ""}
                onChange={e => update("estado", e.target.value.toUpperCase().slice(0, 2))}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="SP"
                maxLength={2}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Nº de unidades</Label>
              <Input
                type="number" min="1"
                value={formData.qtd_unidades ?? ""}
                onChange={e => update("qtd_unidades", e.target.value === "" ? null : Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Tipo de rede</Label>
              <Select value={formData.tipo_rede || ""} onValueChange={v => update("tipo_rede", v)}>
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
        </div>
      ),
    },
    {
      id: "equipe",
      label: "Composição da Equipe",
      icon: Users,
      description: "Headcount por área e informações de sócios",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Técnicos no pátio</Label>
              <Input
                type="number" min="0"
                value={formData.qtd_tecnicos ?? ""}
                onChange={e => update("qtd_tecnicos", e.target.value === "" ? null : Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Vendedores</Label>
              <Input
                type="number" min="0"
                value={formData.qtd_vendedores ?? ""}
                onChange={e => update("qtd_vendedores", e.target.value === "" ? null : Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Administrativo</Label>
              <Input
                type="number" min="0"
                value={formData.qtd_administrativo ?? ""}
                onChange={e => update("qtd_administrativo", e.target.value === "" ? null : Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="0"
              />
            </div>
          </div>

          {/* Sócio */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => update("tem_socios", !formData.tem_socios)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
                formData.tem_socios
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800/60 border-slate-700/60 text-slate-400 hover:border-slate-500"
              }`}
            >
              <span className="text-sm font-medium">Tem sócios?</span>
              <span className="text-xs">{formData.tem_socios ? "Sim ✓" : "Não"}</span>
            </button>
            {formData.tem_socios && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Nome do sócio</Label>
                  <Input
                    value={formData.nome_socio || ""}
                    onChange={e => update("nome_socio", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">Telefone do sócio</Label>
                  <Input
                    value={formData.telefone_socio || ""}
                    onChange={e => update("telefone_socio", e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "relacionamento",
      label: "Relacionamento & Histórico",
      icon: Heart,
      description: "Consultoria prévia, engajamento e produtos adquiridos",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Já contratou consultoria?</Label>
              <Select
                value={formData.contratou_consultoria === true ? "sim" : formData.contratou_consultoria === false ? "nao" : ""}
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
                value={formData.tempo_seguindo || ""}
                onChange={e => update("tempo_seguindo", e.target.value)}
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                placeholder="Ex: 6 meses, 2 anos"
              />
            </div>
          </div>

          {/* Já é cliente */}
          <div className="space-y-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="ja_cliente_accordion"
                checked={!!formData.ja_cliente}
                onChange={e => {
                  update("ja_cliente", e.target.checked);
                  if (!e.target.checked) update("produtos_comprados", []);
                }}
                className="rounded border-slate-600"
              />
              <Label htmlFor="ja_cliente_accordion" className="text-amber-300 text-xs cursor-pointer flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5" /> Já é cliente (já comprou algum produto)
              </Label>
            </div>
            {formData.ja_cliente && produtos.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs flex items-center gap-1">
                  <Package className="w-3 h-3" /> Quais produtos já comprou?
                </Label>
                <div className="flex flex-wrap gap-2">
                  {produtos.map(p => {
                    const selecionado = (formData.produtos_comprados || []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleProduto(p.id)}
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
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const isOpen = expandedSection === section.id;

        return (
          <motion.div
            key={section.id}
            className="border border-blue-500/20 bg-blue-500/5 rounded-xl overflow-hidden backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => setExpandedSection(isOpen ? null : section.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-500/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">{section.label}</p>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </div>
              </div>
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                <ChevronDown className="w-5 h-5 text-slate-500" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent"
                >
                  <div className="p-5">
                    {section.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );
}