import { Hono } from "hono";
import { cors } from "hono/cors";
import { StatusCode } from "hono/utils/http-status";
import {
  generateRandomId,
  generateCodeChallenge,
  generateCodeVerifier,
} from "./utils";
import { getHTMLTemplate } from "./getHTMLTemplate";

interface Bindings {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  PLUGIN_ID: string;
  PLUGIN_PARENT_DOMAIN: string;
  REDIRECT_URI: string;
  AUTHORIZE_ENDPOINT: string;
  TOKEN_ENDPOINT: string;
  SCOPE: string;
  OAUTH_KV: KVNamespace;
}

const app = new Hono<{ Bindings: Bindings }>();

const corsMiddleware = (env: Bindings) => {
  return cors({
    origin: (origin) => {
      if (!origin)
        return `https://${env.PLUGIN_ID}.${env.PLUGIN_PARENT_DOMAIN}`;

      const originURL = new URL(origin);
      if (originURL.hostname === "localhost") {
        return origin;
      }

      const [hostLabel, ...parentDomainLabels] = originURL.hostname.split(".");
      if (
        parentDomainLabels.join(".") === env.PLUGIN_PARENT_DOMAIN &&
        hostLabel.startsWith(env.PLUGIN_ID)
      ) {
        return origin;
      }

      return `https://${env.PLUGIN_ID}.${env.PLUGIN_PARENT_DOMAIN}`;
    },
  });
};

app.use("*", async (c, next) => {
  return corsMiddleware(c.env)(c, next);
});

// Routes
app.get("/", (c) => {
  return c.text("✅ OAuth Worker is up and running!");
});

// Auth routes
app.post("/auth/authorize", async (c) => {
  const env = c.env;
  const readKey = generateRandomId();
  const writeKey = generateRandomId();

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authorizeParams = new URLSearchParams({
    client_id: env.CLIENT_ID,
    redirect_uri: env.REDIRECT_URI,
    response_type: "code",
    access_type: "online",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  authorizeParams.append("scope", env.SCOPE);
  authorizeParams.append("state", writeKey);

  const authorizeUrl = new URL(env.AUTHORIZE_ENDPOINT);
  authorizeUrl.search = authorizeParams.toString();

  // Store both the readKey and codeVerifier
  await env.OAUTH_KV.put(
    `readKey:${writeKey}`,
    JSON.stringify({
      readKey,
      codeVerifier,
    }),
    {
      expirationTtl: 60,
    },
  );

  return c.json({
    url: authorizeUrl.toString(),
    readKey,
  });
});

app.get("/auth/redirect", async (c) => {
  const env = c.env;
  const { code: authorizationCode, state: writeKey } = c.req.query();

  if (!authorizationCode) {
    return c.text("Missing authorization code URL param", 400);
  }

  if (!writeKey) {
    return c.text("Missing state URL param", 400);
  }

  const storedData = await env.OAUTH_KV.get(`readKey:${writeKey}`);
  if (!storedData) {
    return c.text("No stored data found", 400);
  }

  const { readKey, codeVerifier } = JSON.parse(storedData);

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code: authorizationCode,
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    redirect_uri: env.REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const tokenUrl = new URL(env.TOKEN_ENDPOINT);
  tokenUrl.search = tokenParams.toString();

  const tokenResponse = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (tokenResponse.status !== 200) {
    return c.text(tokenResponse.statusText, tokenResponse.status as StatusCode);
  }

  if (!readKey) {
    return c.text("No read key found in storage", 400);
  }

  const tokens = await tokenResponse.json();
  await env.OAUTH_KV.put(`tokens:${readKey}`, JSON.stringify(tokens), {
    expirationTtl: 300,
  });

  return c.html(
    getHTMLTemplate(
      "Authentication successful! You can close this window and return to Framer.",
    ),
  );
});

app.post("/auth/poll", async (c) => {
  const env = c.env;
  const readKey = c.req.query("readKey");

  if (!readKey) {
    return c.text("Missing read key URL param", 400);
  }

  const tokens = await env.OAUTH_KV.get(`tokens:${readKey}`);

  if (!tokens) {
    return c.notFound();
  }

  await env.OAUTH_KV.delete(`tokens:${readKey}`);

  return c.json(JSON.parse(tokens));
});

app.post("/auth/refresh", async (c) => {
  const env = c.env;
  const refreshToken = c.req.query("code");

  if (!refreshToken) {
    return c.text("Missing refresh token URL param", 400);
  }

  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
  });

  const refreshUrl = new URL(env.TOKEN_ENDPOINT);
  refreshUrl.search = refreshParams.toString();

  const refreshResponse = await fetch(refreshUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (refreshResponse.status !== 200) {
    return c.text(refreshResponse.statusText);
  }

  const tokens = await refreshResponse.json();

  return c.json(tokens as Record<string, unknown>);
});

// Error handling
app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  return c.text(`😔 Internal error: ${message}`, 500);
});

// 404 handler
app.notFound((c) => {
  return c.text("Page not found", 404);
});

export default app;
