// Token Endpoint - Supports authorization_code, refresh_token, and client_credentials
import type { Router } from "express";
import express from "express";
import {
  getAuthorizationCode,
  deleteAuthorizationCode,
  getRefreshToken,
  deleteRefreshToken,
  setAccessToken,
  setRefreshToken,
  getRegisteredClient,
  TOKEN_EXPIRATION_MS,
  REFRESH_TOKEN_EXPIRATION_MS,
} from "../../auth/token-store.js";
import {
  verifyCodeChallenge,
  generateAccessToken,
  generateRefreshToken as generateNewRefreshToken,
} from "../../auth/pkce.js";
import { getClientCredentials } from "../../auth/credentials.js";
import { logger } from "../../logging/console-logger.js";

export function registerTokenRoutes(router: Router): void {
  router.post("/token", express.json(), express.urlencoded({ extended: true }), (req, res) => {
    logger.debug(`Token request received: ${JSON.stringify(req.body)}`);
    const grantType = req.body.grant_type as string | undefined;
    const clientId = req.body.client_id as string | undefined;
    const clientSecret = req.body.client_secret as string | undefined;

    // Handle authorization_code grant (OAuth 2.1 with PKCE)
    if (grantType === "authorization_code") {
      const code = req.body.code as string | undefined;
      const codeVerifier = req.body.code_verifier as string | undefined;
      const redirectUri = req.body.redirect_uri as string | undefined;

      if (!code || !codeVerifier) {
        logger.debug(`Token error: Missing code or code_verifier`);
        res.status(400).json({
          error: "invalid_request",
          error_description: "Missing code or code_verifier",
        });
        return;
      }

      const authCode = getAuthorizationCode(code);
      if (!authCode) {
        logger.debug(`Token error: Invalid or expired authorization code`);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Invalid or expired authorization code",
        });
        return;
      }

      // Verify code hasn't expired
      if (Date.now() > authCode.expiresAt) {
        deleteAuthorizationCode(code);
        logger.debug(`Token error: Authorization code has expired`);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Authorization code has expired",
        });
        return;
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
        return;
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
        return;
      }

      // Verify PKCE code_verifier
      if (
        !verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)
      ) {
        logger.debug(`Token error: Invalid code_verifier`);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Invalid code_verifier",
        });
        return;
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
      return;
    }

    // Handle refresh_token grant
    if (grantType === "refresh_token") {
      const refreshToken = req.body.refresh_token as string | undefined;

      if (!refreshToken) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "Missing refresh_token",
        });
        return;
      }

      const storedRefresh = getRefreshToken(refreshToken);
      if (!storedRefresh) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Invalid refresh token",
        });
        return;
      }

      if (Date.now() > storedRefresh.expiresAt) {
        deleteRefreshToken(refreshToken);
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Refresh token has expired",
        });
        return;
      }

      // Rotate refresh token (OAuth 2.1 requirement)
      deleteRefreshToken(refreshToken);
      const newRefreshToken = generateNewRefreshToken();
      const accessToken = generateAccessToken();
      const expiresIn = TOKEN_EXPIRATION_MS / 1000;

      setAccessToken(accessToken, {
        expiresAt: Date.now() + TOKEN_EXPIRATION_MS,
      });

      setRefreshToken(newRefreshToken, {
        clientId: storedRefresh.clientId,
        expiresAt: Date.now() + REFRESH_TOKEN_EXPIRATION_MS,
      });

      logger.info(`Access token refreshed for client: ${storedRefresh.clientId}`);

      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        refresh_token: newRefreshToken,
      });
      return;
    }

    // Handle client_credentials grant (machine-to-machine)
    if (grantType === "client_credentials") {
      // Validate client credentials against static config or registered clients
      const staticCreds = getClientCredentials();
      const client = clientId ? getRegisteredClient(clientId) : undefined;
      const isValidStatic =
        staticCreds &&
        clientId === staticCreds.clientId &&
        clientSecret === staticCreds.clientSecret;
      const isValidRegistered = client && client.clientSecret === clientSecret;

      if (!isValidStatic && !isValidRegistered) {
        res.status(401).json({
          error: "invalid_client",
          error_description: "Invalid client_id or client_secret.",
        });
        return;
      }

      const accessToken = generateAccessToken();
      const expiresIn = TOKEN_EXPIRATION_MS / 1000;

      setAccessToken(accessToken, {
        expiresAt: Date.now() + TOKEN_EXPIRATION_MS,
      });

      logger.info(`Access token issued for client: ${clientId} (client_credentials)`);

      res.json({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: expiresIn,
      });
      return;
    }

    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Supported grant types: authorization_code, refresh_token, client_credentials",
    });
  });
}
