import { Bindings, RefreshTokensResponse, TokenData } from "./types";

export async function getAccessToken(
  env: Bindings,
  tokenData: TokenData,
): Promise<string | null> {
  const refreshParams = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenData.refresh_token,
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
    return null;
  }

  const newTokens: RefreshTokensResponse = await refreshResponse.json();

  return newTokens.access_token;
}
