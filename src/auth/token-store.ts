// OAuth 2.1 token storage (in-memory)
import type {
  AccessTokenData,
  RefreshTokenData,
  AuthorizationCode,
  PendingAuthorization,
  RegisteredClient,
} from "./types.js";

// Token expiration times
export const TOKEN_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour
export const REFRESH_TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const AUTH_CODE_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes
export const PENDING_AUTH_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

// In-memory token stores
const accessTokens = new Map<string, AccessTokenData>();
const refreshTokens = new Map<string, RefreshTokenData>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const pendingAuthorizations = new Map<string, PendingAuthorization>();
const registeredClients = new Map<string, RegisteredClient>();

// Access tokens
export function getAccessToken(token: string): AccessTokenData | undefined {
  return accessTokens.get(token);
}

export function setAccessToken(token: string, data: AccessTokenData): void {
  accessTokens.set(token, data);
}

export function deleteAccessToken(token: string): boolean {
  return accessTokens.delete(token);
}

export function validateAccessToken(token: string): boolean {
  const tokenData = accessTokens.get(token);
  if (!tokenData) return false;
  if (Date.now() > tokenData.expiresAt) {
    accessTokens.delete(token);
    return false;
  }
  return true;
}

// Refresh tokens
export function getRefreshToken(token: string): RefreshTokenData | undefined {
  return refreshTokens.get(token);
}

export function setRefreshToken(token: string, data: RefreshTokenData): void {
  refreshTokens.set(token, data);
}

export function deleteRefreshToken(token: string): boolean {
  return refreshTokens.delete(token);
}

// Authorization codes
export function getAuthorizationCode(code: string): AuthorizationCode | undefined {
  return authorizationCodes.get(code);
}

export function setAuthorizationCode(code: string, data: AuthorizationCode): void {
  authorizationCodes.set(code, data);
}

export function deleteAuthorizationCode(code: string): boolean {
  return authorizationCodes.delete(code);
}

// Pending authorizations (CSRF protection)
export function getPendingAuthorization(csrfToken: string): PendingAuthorization | undefined {
  return pendingAuthorizations.get(csrfToken);
}

export function setPendingAuthorization(csrfToken: string, data: PendingAuthorization): void {
  pendingAuthorizations.set(csrfToken, data);
}

export function deletePendingAuthorization(csrfToken: string): boolean {
  return pendingAuthorizations.delete(csrfToken);
}

// Registered clients
export function getRegisteredClient(clientId: string): RegisteredClient | undefined {
  return registeredClients.get(clientId);
}

export function setRegisteredClient(clientId: string, data: RegisteredClient): void {
  registeredClients.set(clientId, data);
}

export function hasRegisteredClient(clientId: string): boolean {
  return registeredClients.has(clientId);
}

// Testing helpers
export function _clearAllTokens(): void {
  accessTokens.clear();
  refreshTokens.clear();
  authorizationCodes.clear();
  pendingAuthorizations.clear();
  registeredClients.clear();
}
