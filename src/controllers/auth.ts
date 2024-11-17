import { Hono } from "hono";
import { StatusCode } from "hono/utils/http-status";
import { vValidator } from "@hono/valibot-validator";
import * as v from "valibot";
import { getFramerHTMLTemplate } from "../utils/templates";
import { APIError } from "../utils/errors";
import {
  generateRandomId,
  generateCodeVerifier,
  generateCodeChallenge,
} from "../utils/helpers";
import { fetchUser } from "../services/auth";
import type { TokensResponse, AppContext } from "../types";

const router = new Hono<AppContext>();

router.post("/authorize", async (c) => {
  const env = c.env;
  const readKey = generateRandomId();
  const writeKey = generateRandomId();

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authorizeParams = new URLSearchParams({
    client_id: env.CLIENT_ID,
    redirect_uri: `${env.WORKER_URL}${env.REDIRECT_PATH}`,
    response_type: "code",
    prompt: "consent",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  authorizeParams.append("scope", env.SCOPE);
  authorizeParams.append("state", writeKey);

  const authorizeUrl = new URL(env.AUTHORIZE_ENDPOINT);
  authorizeUrl.search = authorizeParams.toString();

  await c
    .get("kv")
    .oauth.put({ writeKey }, { readKey, codeVerifier }, { expirationTtl: 60 });

  return c.json({
    url: authorizeUrl.toString(),
    readKey,
  });
});

router.get(
  "/redirect",
  vValidator(
    "query",
    v.object({
      code: v.string(),
      state: v.string(),
    }),
  ),
  async (c) => {
    const env = c.env;
    const { code: authorizationCode, state: writeKey } = c.req.valid("query");

    const storedTokens = await c
      .get("kv")
      .oauth.getOrThrow({ writeKey }, "Invalid write key");

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      redirect_uri: `${env.WORKER_URL}${env.REDIRECT_PATH}`,
      code_verifier: storedTokens.codeVerifier,
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
      return c.text(
        tokenResponse.statusText,
        tokenResponse.status as StatusCode,
      );
    }

    const tokens: TokensResponse = await tokenResponse.json();

    // Extract org ID from the identity URL
    const identityUrl = new URL(tokens.id);
    const orgId = identityUrl.pathname.split("/")[2];

    const user = await fetchUser(tokens.access_token);

    await c.get("kv").storedTokens.put(
      { userId: user.user_id },
      {
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
        orgId,
      },
    );

    // Store tokens response temporarily for polling
    await c
      .get("kv")
      .tempTokens.put({ readKey: storedTokens.readKey }, tokens, {
        expirationTtl: 300,
      });

    return c.html(
      getFramerHTMLTemplate(
        "Authentication successful! You can close this window and return to Framer.",
      ),
    );
  },
);

router.post(
  "/poll",
  vValidator(
    "query",
    v.object({
      readKey: v.string(),
    }),
  ),
  async (c) => {
    const { readKey } = c.req.valid("query");
    const tokens = await c
      .get("kv")
      .tempTokens.getOrThrow({ readKey }, "Invalid read key");

    await c.get("kv").tempTokens.delete({ readKey });

    return c.json(tokens);
  },
);

router.post(
  "/refresh",
  vValidator(
    "query",
    v.object({
      code: v.string(),
    }),
  ),
  async (c) => {
    const env = c.env;
    const { code: refresh_token } = c.req.valid("query");

    if (!refresh_token) {
      throw new APIError("Missing refresh token", 400);
    }

    const tokenParams = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
    });

    const tokenUrl = new URL(env.TOKEN_ENDPOINT);
    tokenUrl.search = tokenParams.toString();

    const tokenRes = await fetch(tokenUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (tokenRes.status !== 200) {
      return c.text(tokenRes.statusText, tokenRes.status as StatusCode);
    }

    const tokens: TokensResponse = await tokenRes.json();

    return c.json(tokens);
  },
);

export { router as authController };
