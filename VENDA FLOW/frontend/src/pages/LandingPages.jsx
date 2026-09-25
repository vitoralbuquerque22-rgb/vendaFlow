import { useState } from "react";
import { api } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, FileText, TrendingUp, Eye, Trash2, Copy, ExternalLink, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LandingPageModal from "@/components/landing/LandingPageModal";

export default function LandingPages() {
  const [modalAberto, setModalAberto] = useState(false);
  const [landingEditando, setLandingEditando] = useState(null);
  const queryClient = useQueryClient();

  const { data: landingPages = [] } = useQuery({
    queryKey: ["landing-pages"],
    queryFn: () => api.entities.LandingPage.list("-created_date"),
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["respostas-diagnostico"],
    queryFn: () => api.entities.RespostaDiagnostico.list("-created_date"),
  });

  const deletarMutation = useMutation({
    mutationFn: (id) => api.entities.LandingPage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-pages"] });
      toast.success("Landing page excluída!");
    },
  });

  const copiarLink = (slug) => {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/LandingPagePublica?slug=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para área de transferência!");
  };

  const tipoConfig = {
    ebook: { label: "E-book", color: "bg-blue-500/20 text-blue-400" },
    diagnostico: { label: "Diagnóstico", color: "bg-purple-500/20 text-purple-400" },
    webinar: { label: "Webinar", color: "bg-emerald-500/20 text-emerald-400" },
    consultoria: { label: "Consultoria", color: "bg-orange-500/20 text-orange-400" },
  };

  const totalVisitas = landingPages.reduce((acc, lp) => acc + (lp.total_visitas || 0), 0);
  const totalConversoes = landingPages.reduce((acc, lp) => acc + (lp.total_conversoes || 0), 0);
  const taxaConversaoGeral = totalVisitas > 0 ? ((totalConversoes / totalVisitas) * 100).toFixed(1) : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Landing Pages</h1>
          <p className="text-slate-400 mt-1">Crie páginas de captura e diagnósticos para gerar leads qualificados</p>
        </div>
        <Button
          onClick={() => {
            setLandingEditando(null);
            setModalAberto(true);
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Landing Page
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm">Total de Visitas</p>
              <p className="text-2xl font-bold text-white">{totalVisitas}</p>
            </div>
            <Eye className="w-8 h-8 text-blue-400" />
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-emerald-300 text-sm">Conversões</p>
              <p className="text-2xl font-bold text-white">{totalConversoes}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-400" />
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/30">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-sm">Taxa de Conversão</p>
              <p className="text-2xl font-bold text-white">{taxaConversaoGeral}%</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </CardContent>
        </Card>
      </div>

      {/* Lista de Landing Pages */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Landing Pages Criadas</CardTitle>
        </CardHeader>
        <CardContent>
          {landingPages.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Nenhuma landing page criada</h3>
              <p className="text-slate-400 mb-4">Crie sua primeira página de captura ou diagnóstico</p>
              <Button
                onClick={() => {
                  setLandingEditando(null);
                  setModalAberto(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Landing Page
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-300">Título</TableHead>
                  <TableHead className="text-slate-300">Tipo</TableHead>
                  <TableHead className="text-slate-300">Visitas</TableHead>
                  <TableHead className="text-slate-300">Conversões</TableHead>
                  <TableHead className="text-slate-300">Taxa</TableHead>
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300 w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {landingPages.map((lp) => {
                  const tipo = tipoConfig[lp.tipo] || tipoConfig.ebook;
                  const taxa = lp.total_visitas > 0 
                    ? ((lp.total_conversoes / lp.total_visitas) * 100).toFixed(1) 
                    : 0;

                  return (
                    <TableRow key={lp.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{lp.titulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", tipo.color)}>
                          {tipo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-300">{lp.total_visitas || 0}</TableCell>
                      <TableCell className="text-slate-300">{lp.total_conversoes || 0}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "font-semibold",
                          taxa >= 5 ? "text-emerald-400" : taxa >= 2 ? "text-yellow-400" : "text-slate-400"
                        )}>
                          {taxa}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={lp.ativa ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600 text-slate-400"}>
                          {lp.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copiarLink(lp.slug)}
                            className="text-slate-400 hover:text-white"
                            title="Copiar link"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const url = `${window.location.origin}/LandingPagePublica?slug=${lp.slug}`;
                              window.open(url, '_blank');
                            }}
                            className="text-slate-400 hover:text-white"
                            title="Visualizar"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setLandingEditando(lp);
                              setModalAberto(true);
                            }}
                            className="text-slate-400 hover:text-white"
                            title="Editar"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Deseja excluir esta landing page?")) {
                                deletarMutation.mutate(lp.id);
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <LandingPageModal
        open={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setLandingEditando(null);
        }}
        landing={landingEditando}
      />
    </div>
  );
}