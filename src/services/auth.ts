import { Context } from "hono";
import type {
  AppBindings,
  AppContext,
  KVStores,
  RefreshTokensResponse,
  SFUser,
} from "../types";
import { APIError, SalesforceAPIError } from "../utils/errors";
import { StatusCode } from "hono/utils/http-status";

interface RefreshTokenError {
  error: string;
  error_description: string;
}

export async function fetchNewAccessToken(
  env: AppBindings,
  refreshToken: string,
): Promise<string> {
  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
  });

  const refreshUrl = new URL(`${env.OAUTH_BASE_URL}${env.TOKEN_PATH}`);
  refreshUrl.search = refreshParams.toString();

  const refreshRes = await fetch(refreshUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (refreshRes.status !== 200) {
    const errorData: RefreshTokenError = await refreshRes.json();
    throw new APIError(errorData.error_description, 401);
  }

  const tokens: RefreshTokensResponse = await refreshRes.json();

  return tokens.access_token;
}

export async function fetchUser(
  env: AppBindings,
  accessToken: string,
): Promise<SFUser> {
  const res = await fetch(env.OAUTH_BASE_URL + "/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new APIError("Failed to fetch Salesforce user");
  }

  return res.json();
}

export async function revokeSalesforceRefreshToken(
  env: AppBindings,
  refreshToken: string,
): Promise<void> {
  const response = await fetch(env.OAUTH_BASE_URL + "/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${refreshToken}`,
  });

  // Successful revoke
  if (response.ok) return;

  // Token is invalid or already revoked, ignore
  if (response.status === 400) {
    return;
  }

  throw new SalesforceAPIError(
    "Failed to revoke refresh token",
    response.status as StatusCode,
  );
}

/**
 * Delete all user data from KV
 */
export async function deleteUserTokens(
  kv: KVStores,
  userId: string,
): Promise<void> {
  // Delete refresh token
  await kv.storedTokens.delete({ userId });

  // Delete associated webFormTokens
  const webFormTokenKeys = await kv.webFormTokens.listKeys({
    formToken: `web:${userId}`,
  });

  for (const key of webFormTokenKeys) {
    await kv.webFormTokens.delete({ formToken: key.split(":")[1] });
  }
}

export async function logout(c: Context) {
  const { userId } = c.get("user");
  const kv = c.get("kv");

  // Revoke refresh tokens
  const storedTokens = await kv.storedTokens.get({ userId });
  if (storedTokens) {
    await revokeSalesforceRefreshToken(c.env, storedTokens.refreshToken);
  }

  // Delete all user data
  await deleteUserTokens(c.get("kv"), userId);
}
