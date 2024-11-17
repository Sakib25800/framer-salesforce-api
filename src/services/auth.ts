import type { AppBindings, RefreshTokensResponse, SFUser } from "../types";
import { APIError } from "../utils/errors";

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

  const refreshUrl = new URL(env.TOKEN_ENDPOINT);
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

export async function fetchUser(accessToken: string): Promise<SFUser> {
  const res = await fetch(
    "https://login.salesforce.com/services/oauth2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new APIError("Failed to fetch Salesforce user");
  }

  return res.json();
}
