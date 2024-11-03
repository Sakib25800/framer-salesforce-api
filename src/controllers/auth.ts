import { Hono } from "hono";
import type { Bindings, StoredToken, TokensResponse } from "../types";
import {
  generateRandomId,
  generateCodeVerifier,
  generateCodeChallenge,
} from "../utils/helpers";
import { getFramerHTMLTemplate } from "../utils/templates";
import { StatusCode } from "hono/utils/http-status";
import { APIError } from "../utils/errors";

const router = new Hono<{ Bindings: Bindings }>();

router.post("/authorize", async (c) => {
  const env = c.env;
  const readKey = generateRandomId();
  const writeKey = generateRandomId();

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

router.get("/redirect", async (c) => {
  const env = c.env;
  const { code: authorizationCode, state: writeKey } = c.req.query();

  if (!authorizationCode) {
    throw new APIError("Missing authorization code URL param", 400);
  }

  if (!writeKey) {
    throw new APIError("Missing state URL param", 400);
  }

  const storedData = await env.OAUTH_KV.get(`readKey:${writeKey}`);
  if (!storedData) {
    throw new APIError("No stored data found", 404);
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

  const tokens: TokensResponse = await tokenResponse.json();

  // Extract org ID from the identity URL
  const identityUrl = new URL(tokens.id);
  const orgId = identityUrl.pathname.split("/")[2];

  // Only store refresh token and instance URL permanently
  const StoredToken: StoredToken = {
    refresh_token: tokens.refresh_token,
    instance_url: tokens.instance_url,
  };

  // Store minimal data permanently
  await env.OAUTH_KV.put(`org:${orgId}`, JSON.stringify(StoredToken));

  // Store full token response temporarily for polling
  await env.OAUTH_KV.put(`tokens:${readKey}`, JSON.stringify(tokens), {
    expirationTtl: 300,
  });

  return c.html(
    getFramerHTMLTemplate(
      "Authentication successful! You can close this window and return to Framer.",
    ),
  );
});

router.post("/poll", async (c) => {
  const env = c.env;
  const readKey = c.req.query("readKey");

  if (!readKey) {
    throw new APIError("Mising read key URL param", 404);
  }

  const tokens = await env.OAUTH_KV.get(`tokens:${readKey}`);
  if (!tokens) {
    throw new APIError("No tokens", 404);
  }

  await env.OAUTH_KV.delete(`tokens:${readKey}`);
  return c.json(JSON.parse(tokens));
});

export { router as auth };
