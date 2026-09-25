# Regras de acesso por entidade (campo `rls`)

Geradas de `backend/entities/*.jsonc`. Aplicadas em `backend/src/entities.ts` (`accessFilter`, `ruleToFilter`).
Semântica implementada: sem regra para a operação → qualquer usuário **logado** pode; sem login só passa regra
`{ "allow": true }`; `api.asServiceRole` (funções) ignora as regras. Templates: `{{user.email}}`, `{{user.id}}`,
`{{user.data.<campo>}}`. `user_condition` compara campos do usuário (ex.: `role`).

| Entidade | Campos | read | create | update | delete |
|---|---|---|---|---|---|
| Alerta | 16 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Atividade | 21 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"user_condition":{"role":"admin"}}` |
| AutomacaoRegra | 8 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| AvaliacaoProduto | 10 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Cadencia | 8 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CallSession | 24 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CampanhaAgendada | 15 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CampanhaVendaFlow | 12 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CategoriaProduto | 4 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ComentarioGravacao | 8 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CommercialInsights | 13 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ConfiguracaoAlerta | 13 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ConfiguracaoMeta | 13 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ConviteEmpresa | 7 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| CustomRole | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| EmailEnvio | 15 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| EmailTemplate | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Empresa | 11 | `{"$or":[{"data.ownerEmail":"{{user.email}}"},{"id":"{{user.data.empresaAtualId}}"}]}` | `{"user_condition":{"role":"admin"}}` | `{"data.ownerEmail":"{{user.email}}"}` | `{"user_condition":{"role":"admin"}}` |
| EmpresaVendedora | 5 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Equipe | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| FaturamentoLead | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| FeedbackContestacao | 13 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| FeedbackLigacao | 15 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Filial | 7 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | — (qualquer logado) | `{"$or":[{"user_condition":{"role":"gestor_empresa"}},{"user_condition":{"role":"gerente_empresa"}},{"user_condition":{"role":"admin"}}]}` | `{"user_condition":{"role":"gestor_empresa"}}` |
| Formulario | 7 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| FormularioSPIN | 9 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| GravacaoLigacao | 48 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Integracao | 11 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"user_condition":{"role":"admin"}}` |
| LandingPage | 14 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Lead | 83 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | — (qualquer logado) | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"user_condition":{"role":"admin"}}` |
| LeadScore | 10 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| LigacaoRastreada | 21 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| LogAcesso | 12 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| LogAutomacao | 8 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| LogImpersonacao | 9 | `{"user_condition":{"role":"super_admin"}}` | `{"user_condition":{"role":"super_admin"}}` | `{"user_condition":{"role":"super_admin"}}` | `{"user_condition":{"role":"super_admin"}}` |
| MarketingAttribution | 23 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| MonitoramentoLog | 10 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| PDI | 12 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| PermissionChangeRequest | 29 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Produto | 11 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ProfileTemplate | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| ProgramacaoDistribuicao | 13 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| RBACLog | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| RegraDistribuicao | 11 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| RelatorioPerformance | 6 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| RespostaDiagnostico | 8 | — (qualquer logado) | `{"allow":true}` | — (qualquer logado) | — (qualquer logado) |
| Script | 11 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| SdrDailyStats | 15 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| SpinResposta | 11 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| SystemMetric | 17 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| Tarefa | 22 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"user_condition":{"role":"admin"}}` |
| TranscriptionJob | 27 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| TreinamentoAssistido | 15 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| User | 5 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| UserPerformanceMetrics | 16 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| UserProfile | 18 | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) | — (qualquer logado) |
| VinculoEmpresa | 6 | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | — (qualquer logado) | `{"data.empresaId":"{{user.data.empresaAtualId}}"}` | `{"user_condition":{"role":"admin"}}` |

**9 de 57 entidades têm alguma regra.** A entidade `User` tem regras próprias no código: admin vê todos; demais só a si mesmos.
