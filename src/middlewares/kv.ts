import { createMiddleware } from "hono/factory";
import { AppContext, AppBindings } from "../types";
import { KV } from "../utils/kv";
import * as kvSchemas from "../schemas/kv";

export const createKVStores = (env: AppBindings) => ({
  oauth: new KV(env.OAUTH_KV, {
    schema: kvSchemas.tempOAuthDataSchema,
    key: {
      pattern: "readKey:{writeKey}",
      params: ["writeKey"],
    },
  }),

  tempTokens: new KV(env.OAUTH_KV, {
    schema: kvSchemas.tempTokensSchema,
    key: {
      pattern: "tokens:{readKey}",
      params: ["readKey"],
    },
  }),

  storedTokens: new KV(env.USERS_KV, {
    schema: kvSchemas.storedTokenSchema,
    key: {
      pattern: "user:{userId}",
      params: ["userId"],
    },
  }),

  webFormTokens: new KV(env.FORMS_KV, {
    schema: kvSchemas.webFormTokenSchema,
    key: {
      pattern: "web:{formToken}",
      params: ["formToken"],
    },
  }),
});

export const kvMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const stores = createKVStores(c.env);
  c.set("kv", stores);
  await next();
});
