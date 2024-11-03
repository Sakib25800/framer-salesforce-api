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
