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

export interface SFUser {
  sub: string;
  user_id: string;
  organization_id: string;
  name: string;
  urls: {
    custom_domain: string; // = instance url
  };
  // Add more properties as needed
}
