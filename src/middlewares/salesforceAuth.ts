import { Context, Next } from "hono";
import type { Bindings, SFUser, StoredToken } from "../types";
import { getAccessToken } from "../services/auth";
import { APIError } from "../utils/errors";

interface SalesforceContext {
  accessToken: string;
  orgId: string;
  instanceUrl: string;
}

declare module "hono" {
  interface ContextVariableMap {
    salesforce: SalesforceContext;
  }
}

export async function salesforceAuth(
  c: Context<{ Bindings: Bindings }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new APIError("Missing or invalid Authorization header", 401);
  }

  const accessToken = authHeader.substring(7);

  try {
    // First get the user info to get their org ID
    const response = await fetch(
      "https://login.salesforce.com/services/oauth2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new APIError("Invalid access token", 401);
    }

    const userInfo: SFUser = await response.json();
    const orgId = userInfo.organization_id;

    const storedTokens = await c.env.OAUTH_KV.get(`org:${orgId}`);
    if (!storedTokens) {
      throw new APIError("Organization not registered in our system", 401);
    }

    const { instance_url } = JSON.parse(storedTokens) as StoredToken;

    c.set("salesforce", {
      accessToken,
      orgId,
      instanceUrl: instance_url,
    });

    await next();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError("Failed to validate Salesforce token", 401);
  }
}
