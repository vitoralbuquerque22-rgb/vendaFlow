// Cliente usado pelas funções do backend (pasta functions/).
//
// Uso dentro de uma função:
//   const api = createClientFromRequest(req);
//   const user = await api.auth.me();                         // usuário logado (ou null)
//   await api.entities.Lead.filter({ empresaId });            // respeita as regras de acesso do usuário
//   await api.asServiceRole.entities.Lead.update(id, dados);  // acesso total, ignora as regras
//
// Tudo roda no mesmo processo do servidor, sem chamadas HTTP.

import { ANONYMOUS, type AuthContext, inviteUser, publicUser, updateUser } from "./auth.ts";
import * as entities from "./entities.ts";
import { runIntegration } from "./integrations.ts";
import { callFunction } from "./functions.ts";

type Rec = Record<string, unknown>;

// Cada requisição recebida por uma função carrega quem está logado
const requestAuth = new WeakMap<Request, AuthContext>();

export function bindRequestAuth(req: Request, auth: AuthContext) {
  requestAuth.set(req, auth);
}

export function createClientFromRequest(req: Request) {
  return createClient(requestAuth.get(req) ?? ANONYMOUS);
}

function entityHandler(entity: string, auth: AuthContext) {
  return {
    list: (sort?: string, limit?: number, skip?: number, fields?: string[] | string) =>
      entities.listRecords(entity, auth, { sort, limit, skip, fields: toFields(fields) }),
    filter: (query?: Rec, sort?: string, limit?: number, skip?: number, fields?: string[] | string) =>
      entities.listRecords(entity, auth, { query, sort, limit, skip, fields: toFields(fields) }),
    get: (id: string) => entities.getRecord(entity, id, auth),
    create: (data: Rec) => entities.createRecord(entity, data, auth),
    update: (id: string, data: Rec) => entities.updateRecord(entity, id, data, auth),
    delete: (id: string) => entities.deleteRecord(entity, id, auth),
    deleteMany: (query: Rec) => entities.deleteMany(entity, query, auth),
    bulkCreate: (items: Rec[]) => entities.bulkCreate(entity, items, auth),
    bulkUpdate: (items: Rec[]) => entities.bulkUpdate(entity, items, auth),
    updateMany: (query: Rec, data: Rec) => entities.updateMany(entity, { query, data }, auth),
  };
}

function toFields(fields?: string[] | string) {
  if (!fields) return undefined;
  return Array.isArray(fields) ? fields : fields.split(",");
}

function entitiesProxy(auth: AuthContext) {
  return new Proxy({} as Record<string, ReturnType<typeof entityHandler>>, {
    get: (_t, name) => (typeof name === "string" ? entityHandler(name, auth) : undefined),
  });
}

function integrationsProxy(auth: AuthContext) {
  const core = new Proxy({} as Record<string, (data: Rec) => Promise<unknown>>, {
    get: (_t, name) => (typeof name === "string" ? (data: Rec) => runIntegration(name, data ?? {}, auth) : undefined),
  });
  return { Core: core };
}

function modules(auth: AuthContext) {
  return {
    entities: entitiesProxy(auth),
    integrations: integrationsProxy(auth),
    functions: { invoke: (name: string, data?: Rec) => callFunction(name, data ?? {}, auth) },
    users: { inviteUser: (email: string, role: string) => inviteUser(auth, { user_email: email, role }) },
  };
}

function createClient(auth: AuthContext) {
  const service: AuthContext = { user: auth.user, service: true };
  return {
    ...modules(auth),
    auth: {
      me: async () => (auth.user ? publicUser(auth.user) : null),
      updateMe: async (data: Rec) => {
        if (!auth.user) throw Object.assign(new Error("Você precisa estar logado"), { status: 401 });
        return publicUser(await updateUser(auth.user.id, data, { allowRole: false }));
      },
    },
    asServiceRole: {
      ...modules(service),
      connectors: {
        getAccessToken: async (type: string): Promise<string> => {
          throw new Error(`Conector não configurado: ${type}`);
        },
      },
    },
  };
}
