// Hierarquia completa de roles — Fase 0
export const SYSTEM_ROLES = {
  // ── Nível global ─────────────────────────────────────────────
  super_admin: {
    name: "Super Admin",
    description: "Acesso total a todos os tenants — modo impersonação disponível",
    color: "red",
    icon: "ShieldAlert",
    level: 10,
  },

  // ── Nível empresa ─────────────────────────────────────────────
  gestor_empresa: {
    name: "Gestor da Empresa",
    description: "Controle total do tenant — configura sistema, usuários e filiais",
    color: "red",
    icon: "Shield",
    level: 7,
  },
  gerente_empresa: {
    name: "Gerente",
    description: "Visão de todas as filiais, sem acesso a configurações do sistema",
    color: "blue",
    icon: "Building2",
    level: 6,
  },
  marketing: {
    name: "Marketing",
    description: "Acesso a campanhas, atribuições e relatórios — nível gerente",
    color: "yellow",
    icon: "Megaphone",
    level: 6,
  },

  // ── Nível filial ──────────────────────────────────────────────
  gerente_filial: {
    name: "Gerente de Filial",
    description: "Gerencia equipes e leads da sua filial",
    color: "indigo",
    icon: "MapPin",
    level: 5,
  },
  supervisor: {
    name: "Supervisor",
    description: "Monitora equipe, kanban, spy/gravações, reatribui leads",
    color: "orange",
    icon: "Eye",
    level: 4,
  },

  // ── Nível operador ────────────────────────────────────────────
  sdr: {
    name: "SDR",
    description: "Prospecção por telefone e cadência",
    color: "green",
    icon: "Phone",
    level: 2,
  },
  closer: {
    name: "Closer",
    description: "Fechamento de vendas e prospecção própria",
    color: "purple",
    icon: "Target",
    level: 2,
  },
  cs: {
    name: "Customer Success",
    description: "Pós-venda e prospecção de clientes existentes",
    color: "teal",
    icon: "HeartHandshake",
    level: 2,
  },
  social_seller: {
    name: "Social Seller",
    description: "SDR com gestão adicional de redes sociais (BDR)",
    color: "pink",
    icon: "Instagram",
    level: 2,
  },

  // ── Legado (compatibilidade) ──────────────────────────────────
  admin: {
    name: "Admin (legado)",
    description: "Role legada — migrar para gestor_empresa",
    color: "red",
    icon: "Shield",
    level: 7,
  },
  gestor: {
    name: "Gestor (legado)",
    description: "Role legada — migrar para gerente_empresa",
    color: "blue",
    icon: "Users",
    level: 6,
  },
};

export const DEFAULT_ROLE = "sdr";

export const ROLES_DISTRIBUICAO = ["sdr", "closer", "cs", "social_seller"];

export const ROLES_SUPERVISAO = ["supervisor", "gerente_filial", "gerente_empresa", "marketing", "gestor_empresa", "super_admin", "admin", "gestor"];

export const ROLES_ADMIN = ["gestor_empresa", "super_admin", "admin"];

export const NIVEL_CROSS_FILIAL = 5;

export function getNivel(role) {
  return SYSTEM_ROLES[role]?.level ?? 0;
}

export function podeReatribuirLeads(role) {
  return getNivel(role) >= 4;
}

export function podeVerTodasFiliais(role, crossFilialHabilitado = false) {
  if (getNivel(role) >= NIVEL_CROSS_FILIAL) return true;
  return crossFilialHabilitado && getNivel(role) >= 4;
}