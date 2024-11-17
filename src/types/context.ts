import { KVNamespace } from "@cloudflare/workers-types";
import { createKVStores } from "../middlewares/kv";

export interface SalesforceUser {
  accessToken: string;
  orgId: string;
  instanceUrl: string;
  userId: string;
}

export type KVStores = ReturnType<typeof createKVStores>;

export interface AppBindings {
  CLIENT_ID: string;
  WORKER_URL: string;
  CLIENT_SECRET: string;
  PLUGIN_ID: string;
  PLUGIN_PARENT_DOMAIN: string;
  REDIRECT_PATH: string;
  AUTHORIZE_ENDPOINT: string;
  TOKEN_ENDPOINT: string;
  SCOPE: string;
  OAUTH_KV: KVNamespace;
  FORMS_KV: KVNamespace;
  USERS_KV: KVNamespace;
}

export interface AppVariables {
  kv: KVStores;
  user?: SalesforceUser;
}

export interface AppContext {
  Bindings: AppBindings;
  Variables: AppVariables;
}
