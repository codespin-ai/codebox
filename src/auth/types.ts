// OAuth 2.1 type definitions

export type AccessTokenData = {
  expiresAt: number;
};

export type RefreshTokenData = {
  clientId: string;
  expiresAt: number;
};

export type AuthorizationCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
};

export type PendingAuthorization = {
  clientId: string;
  redirectUri: string;
  state: string | undefined;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
};

export type RegisteredClient = {
  clientId: string;
  clientSecret?: string | undefined;
  redirectUris: string[];
  clientName?: string | undefined;
  createdAt: number;
};

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string | undefined;
};

export type OAuthError = {
  error: string;
  error_description: string;
};
