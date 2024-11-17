import * as v from "valibot";

export const tempOAuthDataSchema = v.object({
  readKey: v.string(),
  codeVerifier: v.string(),
});

export const tempTokensSchema = v.object({
  access_token: v.string(),
  refresh_token: v.string(),
  instance_url: v.string(),
  id: v.string(),
  token_type: v.string(),
  issued_at: v.string(),
  signature: v.string(),
  scope: v.string(),
});

export const storedTokenSchema = v.object({
  refreshToken: v.string(),
  instanceUrl: v.string(),
  orgId: v.string(),
});

export const webFormTokenSchema = v.object({
  objectName: v.string(),
  userId: v.string(),
});

export type TempOAuthData = v.InferOutput<typeof tempOAuthDataSchema>;
export type TempTokens = v.InferOutput<typeof tempTokensSchema>;
export type StoredToken = v.InferOutput<typeof storedTokenSchema>;
export type WebFormToken = v.InferOutput<typeof webFormTokenSchema>;
