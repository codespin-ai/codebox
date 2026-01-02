// Refresh token grant handler

import type { Request, Response } from "express";
import {
  getRefreshToken,
  deleteRefreshToken,
  setAccessToken,
  setRefreshToken,
  TOKEN_EXPIRATION_MS,
  REFRESH_TOKEN_EXPIRATION_MS,
} from "../../../auth/token-store.js";
import {
  generateAccessToken,
  generateRefreshToken as generateNewRefreshToken,
} from "../../../auth/pkce.js";
import { logger } from "../../../logging/console-logger.js";

export function handleRefreshTokenGrant(req: Request, res: Response): boolean {
  const refreshToken = req.body.refresh_token as string | undefined;

  if (!refreshToken) {
    res.status(400).json({
      error: "invalid_request",
      error_description: "Missing refresh_token",
    });
    return true;
  }

  const storedRefresh = getRefreshToken(refreshToken);
  if (!storedRefresh) {
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Invalid refresh token",
    });
    return true;
  }

  if (Date.now() > storedRefresh.expiresAt) {
    deleteRefreshToken(refreshToken);
    res.status(400).json({
      error: "invalid_grant",
      error_description: "Refresh token has expired",
    });
    return true;
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
  return true;
}
