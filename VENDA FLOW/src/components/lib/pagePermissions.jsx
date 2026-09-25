// Permissões por página — Fase 0
// Macro: ALL = acesso total | MANAGE = leitura + escrita | READ = só leitura | NONE = sem acesso

const ALL   = { read: true,  create: true,  update: true,  delete: true  };
const MANAGE= { read: true,  create: true,  update: true,  delete: false };
const READ  = { read: true,  create: false, update: false, delete: false };
const NONE  = { read: false, create: false, update: false, delete: false };

export const PAGE_PERMISSIONS = {
  Dashboard: {
    super_admin: READ, gestor_empresa: READ, gerente_empresa: READ, marketing: READ,
    gerente_filial: READ, supervisor: READ, sdr: READ, closer: READ, cs: READ, social_seller: READ,
    admin: READ, gestor: READ,
  },
  Tarefas: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: NONE,
    gerente_filial: ALL, supervisor: MANAGE, sdr: MANAGE, closer: MANAGE, cs: MANAGE, social_seller: MANAGE,
    admin: ALL, gestor: ALL,
  },
  Leads: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: READ,
    gerente_filial: ALL, supervisor: READ, sdr: MANAGE, closer: MANAGE, cs: MANAGE, social_seller: MANAGE,
    admin: ALL, gestor: ALL,
  },
  Cadencias: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: ALL, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  Scripts: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: ALL, supervisor: READ, sdr: READ, closer: MANAGE, cs: MANAGE, social_seller: READ,
    admin: ALL, gestor: ALL,
  },
  Produtos: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: READ, supervisor: READ, sdr: READ, closer: MANAGE, cs: READ, social_seller: READ,
    admin: ALL, gestor: ALL,
  },
  Formularios: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: ALL, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  EmailMarketing: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: READ, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  LandingPages: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: ALL,
    gerente_filial: READ, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  AssistenteVendas: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: READ,
    gerente_filial: ALL, supervisor: READ, sdr: MANAGE, closer: MANAGE, cs: MANAGE, social_seller: MANAGE,
    admin: ALL, gestor: ALL,
  },
  ConfiguracaoAlertas: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: READ,
    gerente_filial: READ, supervisor: READ, sdr: READ, closer: READ, cs: READ, social_seller: READ,
    admin: ALL, gestor: ALL,
  },
  Relatorios: {
    super_admin: ALL, gestor_empresa: READ, gerente_empresa: READ, marketing: READ,
    gerente_filial: READ, supervisor: READ, sdr: READ, closer: READ, cs: READ, social_seller: READ,
    admin: READ, gestor: READ,
  },
  InteligenciaComercial: {
    super_admin: ALL, gestor_empresa: READ, gerente_empresa: READ, marketing: READ,
    gerente_filial: READ, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: READ, gestor: READ,
  },
  Perfil: {
    super_admin: ALL,
    gestor_empresa:  { read: true, create: false, update: true, delete: false },
    gerente_empresa: { read: true, create: false, update: true, delete: false },
    marketing:       { read: true, create: false, update: true, delete: false },
    gerente_filial:  { read: true, create: false, update: true, delete: false },
    supervisor:      { read: true, create: false, update: true, delete: false },
    sdr:             { read: true, create: false, update: true, delete: false },
    closer:          { read: true, create: false, update: true, delete: false },
    cs:              { read: true, create: false, update: true, delete: false },
    social_seller:   { read: true, create: false, update: true, delete: false },
    admin:           { read: true, create: false, update: true, delete: false },
    gestor:          { read: true, create: false, update: true, delete: false },
  },
  Equipes: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: MANAGE, marketing: READ,
    gerente_filial: MANAGE, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: MANAGE,
  },
  SystemHealth: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: NONE, marketing: NONE,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: NONE,
  },
  Integracoes: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: NONE, marketing: NONE,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: NONE,
  },
  DadosEmpresa: {
    super_admin: ALL,
    gestor_empresa:  { read: true, create: false, update: true, delete: false },
    gerente_empresa: READ, marketing: READ,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: READ,
  },
  MetasPorVendedor: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: READ,
    gerente_filial: MANAGE, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  MetasEmpresa: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: READ, marketing: READ,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: READ,
  },
  Automacoes: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: READ, marketing: READ,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: READ,
  },
  DistribuicaoLeads: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: READ, marketing: NONE,
    gerente_filial: MANAGE, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: READ,
  },
  GestaoRBAC: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: READ, marketing: NONE,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: NONE,
  },
  GerenciamentoEmpresas: {
    super_admin: ALL, gestor_empresa: NONE, gerente_empresa: NONE, marketing: NONE,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: NONE, gestor: NONE,
  },
  EmpresasVendedoras: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: READ, marketing: NONE,
    gerente_filial: NONE, supervisor: NONE, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: READ,
  },
  Gravacoes: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: NONE,
    gerente_filial: ALL, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  MonitoramentoAoVivo: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: NONE,
    gerente_filial: READ, supervisor: READ, sdr: NONE, closer: NONE, cs: NONE, social_seller: NONE,
    admin: ALL, gestor: ALL,
  },
  SolicitarPermissoes: {
    super_admin: ALL, gestor_empresa: ALL, gerente_empresa: ALL, marketing: MANAGE,
    gerente_filial: MANAGE, supervisor: MANAGE, sdr: MANAGE, closer: MANAGE, cs: MANAGE, social_seller: MANAGE,
    admin: ALL, gestor: ALL,
  },
};

export const FEATURE_PERMISSIONS = {
  exportData: {
    super_admin: true, gestor_empresa: true, gerente_empresa: true, marketing: true,
    gerente_filial: true, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: true,
  },
  viewAllLeads: {
    super_admin: true, gestor_empresa: true, gerente_empresa: true, marketing: true,
    gerente_filial: true, supervisor: true, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: true,
  },
  inviteUsers: {
    super_admin: true, gestor_empresa: true, gerente_empresa: false, marketing: false,
    gerente_filial: false, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: true,
  },
  manageTeams: {
    super_admin: true, gestor_empresa: true, gerente_empresa: true, marketing: false,
    gerente_filial: true, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: true,
  },
  viewAnalytics: {
    super_admin: true, gestor_empresa: true, gerente_empresa: true, marketing: true,
    gerente_filial: true, supervisor: true, sdr: true, closer: true, cs: true, social_seller: true,
    admin: true, gestor: true,
  },
  manageIntegrations: {
    super_admin: true, gestor_empresa: true, gerente_empresa: false, marketing: false,
    gerente_filial: false, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: false,
  },
  reatribuirLeads: {
    super_admin: true, gestor_empresa: true, gerente_empresa: true, marketing: false,
    gerente_filial: true, supervisor: true, sdr: false, closer: false, cs: false, social_seller: false,
    admin: true, gestor: true,
  },
  impersonar: {
    super_admin: true, gestor_empresa: false, gerente_empresa: false, marketing: false,
    gerente_filial: false, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: false, gestor: false,
  },
  gerenciarEmpresas: {
    super_admin: true, gestor_empresa: false, gerente_empresa: false, marketing: false,
    gerente_filial: false, supervisor: false, sdr: false, closer: false, cs: false, social_seller: false,
    admin: false, gestor: false,
  },
};