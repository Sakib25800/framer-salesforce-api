import { createMiddleware } from "hono/factory";
import { APIError } from "../utils/errors";
import { fetchNewAccessToken, fetchUser, logout } from "../services/auth";
import { AppBindings, AppVariables, SalesforceUser } from "../types";

export const authMiddleware = createMiddleware<{
  Bindings: AppBindings;
  Variables: AppVariables & {
    user: SalesforceUser;
  };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new APIError("Missing or invalid Authorization header", 401);
  }

  const accessToken = authHeader.substring(7);

  try {
    const { organization_id, user_id, urls } = await fetchUser(
      c.env,
      accessToken,
    );
    const storedTokenData = await c
      .get("kv")
      .storedTokens.getOrThrow({ userId: user_id });

    const freshAccessToken = await fetchNewAccessToken(
      c.env,
      storedTokenData.refreshToken,
    );

    c.set("user", {
      accessToken: freshAccessToken,
      orgId: organization_id,
      instanceUrl: urls.custom_domain,
      userId: user_id,
    });
  } catch (e) {
    // Something has gone wrong, most likely the refresh token is no longer valid
    // so logout and remove all user data
    logout(c);
  }

  await next();
});
