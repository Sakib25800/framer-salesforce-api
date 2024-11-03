export interface StoredToken {
  refresh_token: string;
  instance_url: string;
}

export interface RefreshTokensResponse {
  access_token: string;
  signature: string;
  instance_url: string;
  id: string;
  token_type: "Bearer";
  issued_at: string;
}

export interface TokensResponse extends RefreshTokensResponse {
  refresh_token: string;
  scope: string;
  id_token: string;
}

interface MatchRecord {
  record: {
    Id: string;
  };
}

interface MatchResult {
  matchRecords: MatchRecord[];
}

export interface ObjectErrorResponse {
  duplicateResult: {
    allowSave: boolean;
    duplicateRule: string;
    duplicateRuleEntityType: string;
    errorMessage: string;
    matchResults: MatchResult[];
  };
  errorCode: string;
  message: string;
}

interface ObjectError {
  statusCode: string;
  message: string;
  fields: string[];
}

export interface ObjectSuccessResponse {
  id: string;
  success: boolean;
  errors: ObjectError[];
}

export interface Bindings {
  CLIENT_ID: string;
  WORKER_URL: string;
  CLIENT_SECRET: string;
  PLUGIN_ID: string;
  PLUGIN_PARENT_DOMAIN: string;
  REDIRECT_URI: string;
  AUTHORIZE_ENDPOINT: string;
  TOKEN_ENDPOINT: string;
  SCOPE: string;
  OAUTH_KV: KVNamespace;
}

export interface FormConfig {
  orgId: string;
  objectType: string;
  createdAt: number;
}
