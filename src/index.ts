import { Hono } from "hono";
import { cors } from "hono/cors";
import { StatusCode } from "hono/utils/http-status";
import {
  generateRandomId,
  generateCodeChallenge,
  generateCodeVerifier,
} from "./utils";
import { getHTMLTemplate } from "./getHTMLTemplate";
import {
  Bindings,
  TokenData,
  TokensResponse,
  ObjectSuccessResponse,
  ObjectErrorResponse,
} from "./types";
import { getAccessToken } from "./auth";

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

app.get("/", (c) => {
  return c.text("✅ OAuth Worker is up and running!");
});

app.post("/auth/authorize", async (c) => {
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

  const tokens: TokensResponse = await tokenResponse.json();

  // Extract org ID from the identity URL
  const identityUrl = new URL(tokens.id);
  const orgId = identityUrl.pathname.split("/")[2];

  // Only store refresh token and instance URL permanently
  const tokenData: TokenData = {
    refresh_token: tokens.refresh_token,
    instance_url: tokens.instance_url,
  };

  // Store minimal data permanently
  await env.OAUTH_KV.put(`org:${orgId}`, JSON.stringify(tokenData));

  // Store full token response temporarily for polling
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

  // Delete temporary tokens after reading
  await env.OAUTH_KV.delete(`tokens:${readKey}`);

  return c.json(JSON.parse(tokens));
});

// Forms endpoint
app.post("/forms", async (c) => {
  const env = c.env;
  const { orgId, object } = c.req.query();

  if (!orgId || !object) {
    return c.json({ error: "Missing orgId or object parameter" }, 400);
  }

  // Get stored minimal token data
  const storedTokens = await env.OAUTH_KV.get(`org:${orgId}`);
  if (!storedTokens) {
    return c.json({ error: "No authentication found for this org" }, 401);
  }

  const tokenData: TokenData = JSON.parse(storedTokens);

  // Get fresh access token
  const accessToken = await getAccessToken(env, tokenData);
  if (!accessToken) {
    return c.json({ error: "Failed to get access token" }, 401);
  }

  // Get the form data
  const formData = await c.req.json();

  try {
    // Create object in Salesforce
    const response = await fetch(
      `${tokenData.instance_url}/services/data/v62.0/sobjects/${object}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      },
    );

    const result: ObjectSuccessResponse | ObjectErrorResponse[] =
      await response.json();

    if (!response.ok) {
      const isDuplicateError =
        Array.isArray(result) &&
        result.length > 0 &&
        result[0].errorCode === "DUPLICATES_DETECTED";

      if (!isDuplicateError) {
        throw new Error("Something went wrong");
      }

      const recordId =
        result[0].duplicateResult?.matchResults[0]?.matchRecords[0]?.record?.Id;

      if (!recordId) {
        throw new Error("No record Id found for duplicate object");
      }

      // Update the existing record instead
      const updateResponse = await fetch(
        `${tokenData.instance_url}/services/data/v62.0/sobjects/${object}/${recordId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        },
      );

      if (updateResponse.ok) {
        return c.json({
          id: recordId,
          success: true,
          updated: true,
          errors: [],
        });
      }
    }

    return c.json(result);
  } catch (error) {
    console.error(error);
    return c.json({ error: "Failed to create object in Salesforce" }, 500);
  }
});

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  return c.text(`😔 Internal error: ${message}`, 500);
});

app.notFound((c) => {
  return c.text("Page not found", 404);
});

export default app;
