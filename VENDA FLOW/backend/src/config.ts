// Configuração central do servidor. Tudo vem de variáveis de ambiente (arquivo .env).

function env(name: string, fallback?: string): string {
  const value = Deno.env.get(name);
  if (value !== undefined && value !== "") return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
}

const port = Number(env("PORT", "8000"));

export const config = {
  port,
  databaseUrl: env("DATABASE_URL", "postgres://vendaflow:vendaflow@localhost:5432/vendaflow"),
  jwtSecret: env("JWT_SECRET"),
  // Endereço público do sistema (usado em links de e-mail e URLs de arquivos)
  publicUrl: env("PUBLIC_URL", "http://localhost:5173").replace(/\/$/, ""),

  entitiesDir: env("ENTITIES_DIR", "./entities"),
  functionsDir: env("FUNCTIONS_DIR", "./functions"),
  agentsDir: env("AGENTS_DIR", "./agents"),
  uploadDir: env("UPLOAD_DIR", "./uploads"),
  maxUploadMb: Number(env("MAX_UPLOAD_MB", "50")),

  allowSignup: env("ALLOW_SIGNUP", "true") === "true",
  adminEmails: env("ADMIN_EMAILS", "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),

  smtp: {
    host: env("SMTP_HOST", "localhost"),
    port: Number(env("SMTP_PORT", "1025")),
    secure: env("SMTP_SECURE", "false") === "true",
    user: env("SMTP_USER", ""),
    pass: env("SMTP_PASS", ""),
    from: env("SMTP_FROM", "VendaFlow <nao-responda@vendaflow.local>"),
  },

  claude: {
    model: env("CLAUDE_MODEL", "claude-opus-5"),
    // "default" = se o modelo recusar por política, a API tenta outro modelo automaticamente
    fallbacks: env("CLAUDE_FALLBACKS", "default"),
  },

  google: {
    clientId: env("GOOGLE_CLIENT_ID", ""),
    clientSecret: env("GOOGLE_CLIENT_SECRET", ""),
  },
};

// Papéis que enxergam e administram todos os usuários
export const ADMIN_ROLES = new Set(["admin", "super_admin"]);
