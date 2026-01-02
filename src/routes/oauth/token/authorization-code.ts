// Authorization code grant handler

import type { Request, Response } from "express";
import {
  getAuthorizationCode,
  deleteAuthorizationCode,
  setAccessToken,
  setRefreshToken,
  TOKEN_EXPIRATION_MS,
  REFRESH_TOKEN_EXPIRATION_MS,
} from "../../../auth/token-store.js";
import {
  verifyCodeChallenge,
  generateAccessToken,
  generateRefreshToken as generateNewRefreshToken,
} from "../../../auth/pkce.js";
import { logger } from "../../../logging/console-logger.js";

export function handleAuthorizationCodeGrant(req: Request, res: Response): boolean {
  const clientId = req.body.client_id as string | undefined;
  const code = req.body.code as string | undefined;
  const codeVerifier = req.body.code_verifier as string | undefined;
  const redirectUri = req.body.redirect_uri as string | undefined;

  if (!code || !codeVerifier) {
    logger.debug(`Token error: Missing code or code_verifier`);
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing code or code_verifier",
    });
    return true;
  }

  const authCode = getAuthorizationCode(code);
  if (!authCode) {
    logger.debug(`Token error: Invalid or expired authorization code`);
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Invalid or expired authorization code",
    });
    return true;
  }

  // Verify code hasn't expired
  if (Date.now() > authCode.expiresAt) {
    deleteAuthorizationCode(code);
    logger.debug(`Token error: Authorization code has expired`);
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Authorization code has expired",
    });
    return true;
  }

  // Verify client_id matches (if provided)
  // OAuth 2.1 allows client_id to be omitted if the code is already bound to the client
  if (clientId && authCode.clientId !== clientId) {
    logger.debug(
      `Token error: Client ID mismatch - expected ${authCode.clientId}, got ${clientId}`
    );
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Client ID mismatch",
    });
    return true;
  }

  // Verify redirect_uri matches
  if (authCode.redirectUri !== redirectUri) {
    logger.debug(
      `Token error: Redirect URI mismatch - expected ${authCode.redirectUri}, got ${redirectUri}`
    );
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Redirect URI mismatch",
    });
    return true;
  }

  // Verify PKCE code_verifier
  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    logger.debug(`Token error: Invalid code_verifier`);
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Invalid code_verifier",
    });
    return true;
  }

  // Delete the used authorization code (one-time use)
  deleteAuthorizationCode(code);

  // Generate tokens
  const accessToken = generateAccessToken();
  const refreshToken = generateNewRefreshToken();
  const expiresIn = TOKEN_EXPIRATION_MS / 1000;
  const effectiveClientId = clientId ?? authCode.clientId;

  setAccessToken(accessToken, {
    expiresAt: Date.now() + TOKEN_EXPIRATION_MS,
  });

  setRefreshToken(refreshToken, {
    clientId: effectiveClientId,
    expiresAt: Date.now() + REFRESH_TOKEN_EXPIRATION_MS,
  });

  logger.info(`Access token issued for client: ${effectiveClientId} (authorization_code)`);

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    refresh_token: refreshToken,
  });
  return true;
}
