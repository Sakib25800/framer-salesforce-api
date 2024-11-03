export interface Bindings {
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
}
