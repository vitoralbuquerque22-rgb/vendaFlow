import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Building2, Phone, Mail, Calendar, MoreVertical, MessageCircle, Instagram, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadScoreBadge from "./LeadScoreBadge";
import { formatarTelefone } from "@/lib/formatarTelefone";

const statusConfig = {
  novo: { label: "Novo", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  em_cadencia: { label: "Em Cadência", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  respondeu: { label: "Respondeu", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  reuniao_agendada: { label: "Reunião Agendada", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  reuniao_realizada: { label: "Reunião Realizada", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  qualificado: { label: "Qualificado", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  desqualificado: { label: "Desqualificado", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  sem_interesse: { label: "Sem Interesse", color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
};

const origemConfig = {
  trafego_pago: { label: "Tráfego Pago", color: "bg-orange-500/20 text-orange-400" },
  indicacao: { label: "Indicação", color: "bg-pink-500/20 text-pink-400" },
  organico: { label: "Orgânico", color: "bg-green-500/20 text-green-400" },
  evento: { label: "Evento", color: "bg-violet-500/20 text-violet-400" },
  lista_fria: { label: "Lista Fria", color: "bg-cyan-500/20 text-cyan-400" },
  outro: { label: "Outro", color: "bg-slate-500/20 text-slate-400" },
};

export default function LeadCard({ lead, leadScore, onEdit, onIniciarCadencia, onAgendarReuniao, onExcluir }) {
  const status = statusConfig[lead.status] || statusConfig.novo;
  const origem = origemConfig[lead.origem] || origemConfig.outro;

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 p-4 hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white">{lead.nome}</h3>
            {leadScore && (
              <LeadScoreBadge 
                score={leadScore.score_total} 
                temperatura={leadScore.temperatura}
                size="sm"
                showLabel={false}
              />
            )}
            <Badge variant="outline" className={cn("text-xs border", status.color)}>
              {status.label}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
            {lead.empresa && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                {lead.empresa}
              </span>
            )}
            {lead.cargo && (
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {lead.cargo}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              {formatarTelefone(lead.telefone)}
            </span>
            {lead.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {lead.email}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", origem.color)}>
              {origem.label}
            </Badge>
            {lead.campanha && (
              <Badge variant="outline" className="text-xs bg-slate-700/50 text-slate-300 border-slate-600">
                {lead.campanha}
              </Badge>
            )}
            {lead.dia_cadencia && lead.status === 'em_cadencia' && (
              <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Calendar className="w-3 h-3 mr-1" />
                Dia {lead.dia_cadencia}
              </Badge>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
            <DropdownMenuItem onClick={() => onEdit(lead)} className="text-slate-200 focus:bg-slate-700 focus:text-white">
              Editar Lead
            </DropdownMenuItem>
            {lead.status === 'novo' && (
              <DropdownMenuItem onClick={() => onIniciarCadencia(lead)} className="text-slate-200 focus:bg-slate-700 focus:text-white">
                Iniciar Cadência
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onAgendarReuniao(lead)} className="text-slate-200 focus:bg-slate-700 focus:text-white">
              Agendar Reunião
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => {
                const telefone = lead.telefone?.replace(/\D/g, '');
                window.open(`https://wa.me/55${telefone}`, '_blank');
              }}
              className="text-emerald-400 focus:bg-slate-700 focus:text-emerald-300"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Abrir WhatsApp
            </DropdownMenuItem>
            {lead.instagram && (
              <DropdownMenuItem 
                onClick={() => {
                  const username = lead.instagram.replace('@', '');
                  window.open(`https://instagram.com/${username}`, '_blank');
                }}
                className="text-pink-400 focus:bg-slate-700 focus:text-pink-300"
              >
                <Instagram className="w-4 h-4 mr-2" />
                Abrir Instagram
              </DropdownMenuItem>
            )}
            {onExcluir && (
              <>
                <DropdownMenuSeparator className="bg-slate-700" />
                <DropdownMenuItem
                  onClick={() => onExcluir(lead)}
                  className="text-rose-400 focus:text-rose-300 focus:bg-rose-500/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir Lead
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}