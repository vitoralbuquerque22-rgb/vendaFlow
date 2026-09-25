import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { User, MessageCircle, Activity, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function LeadScoreDetails({ leadScore }) {
  if (!leadScore) return null;

  const detalhes = leadScore.detalhes_pontuacao || {};

  const categorias = [
    {
      titulo: "Perfil",
      icon: User,
      score: leadScore.score_perfil,
      max: 40,
      color: "text-purple-400",
      items: [
        { label: "Formulário completo", ativo: detalhes.formulario_completo, pontos: 10 },
        { label: "Cargo decisor", ativo: detalhes.cargo_decisor, pontos: 10 },
        { label: "Empresa adequada", ativo: detalhes.empresa_adequada, pontos: 10 },
        { label: "Produto definido", ativo: detalhes.produto_definido, pontos: 10 }
      ]
    },
    {
      titulo: "Engajamento",
      icon: MessageCircle,
      score: leadScore.score_engajamento,
      max: 60,
      color: "text-blue-400",
      items: [
        { label: `${detalhes.total_cliques} cliques em emails`, ativo: detalhes.total_cliques > 0, pontos: Math.min(detalhes.total_cliques * 5, 20) },
        { label: "Respondeu email/WhatsApp", ativo: detalhes.respondeu_email, pontos: 15 },
        { label: "Reunião agendada", ativo: detalhes.reuniao_agendada, pontos: 20 },
        { label: "Reunião realizada", ativo: detalhes.reuniao_realizada, pontos: 25 }
      ]
    },
    {
      titulo: "Comportamento",
      icon: Activity,
      score: leadScore.score_comportamento,
      max: 30,
      color: "text-emerald-400",
      items: [
        { label: "Lead aquecido (<24h)", ativo: detalhes.lead_aquecido, pontos: 10 },
        { label: "Múltiplas interações", ativo: detalhes.multiplas_interacoes, pontos: 10 },
        { label: "Interesse múltiplos produtos", ativo: detalhes.interesse_multiplos_produtos, pontos: 10 }
      ]
    }
  ];

  return (
    <div className="space-y-4">
      {/* Score Total */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-slate-400 text-sm">Score Total</p>
              <p className="text-4xl font-bold text-white">{leadScore.score_total}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-400" />
          </div>
          <Progress value={leadScore.score_total} className="h-3" />
          <p className="text-xs text-slate-500 mt-2">
            Última atualização: {leadScore.ultima_atualizacao ? format(new Date(leadScore.ultima_atualizacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"}
          </p>
        </CardContent>
      </Card>

      {/* Categorias */}
      {categorias.map((cat) => {
        const Icon = cat.icon;
        const porcentagem = (cat.score / cat.max) * 100;

        return (
          <Card key={cat.titulo} className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Icon className={cn("w-5 h-5", cat.color)} />
                {cat.titulo}
                <Badge variant="outline" className="ml-auto">
                  {cat.score}/{cat.max}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={porcentagem} className="h-2" />
              
              <div className="space-y-2">
                {cat.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {item.ativo ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600" />
                      )}
                      <span className={cn(
                        item.ativo ? "text-slate-300" : "text-slate-500"
                      )}>
                        {item.label}
                      </span>
                    </div>
                    <span className={cn(
                      "font-medium",
                      item.ativo ? cat.color : "text-slate-600"
                    )}>
                      +{item.pontos}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Histórico */}
      {leadScore.historico_scores && leadScore.historico_scores.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Histórico de Mudanças</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadScore.historico_scores.slice().reverse().map((h, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm border-b border-slate-700 pb-2">
                  <div>
                    <p className="text-slate-300">{h.motivo}</p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(h.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "font-bold",
                      h.score_novo > h.score_anterior ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {h.score_anterior} → {h.score_novo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}