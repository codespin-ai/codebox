// Client credentials grant handler

import type { Request, Response } from "express";
import {
  setAccessToken,
  getRegisteredClient,
  TOKEN_EXPIRATION_MS,
} from "../../../auth/token-store.js";
import { generateAccessToken } from "../../../auth/pkce.js";
import { getClientCredentials } from "../../../auth/credentials.js";
import { logger } from "../../../logging/console-logger.js";

export function handleClientCredentialsGrant(req: Request, res: Response): boolean {
  const clientId = req.body.client_id as string | undefined;
  const clientSecret = req.body.client_secret as string | undefined;

  // Validate client credentials against static config or registered clients
  const staticCreds = getClientCredentials();
  const client = clientId ? getRegisteredClient(clientId) : undefined;
  const isValidStatic =
    staticCreds && clientId === staticCreds.clientId && clientSecret === staticCreds.clientSecret;
  const isValidRegistered = client && client.clientSecret === clientSecret;

  if (!isValidStatic && !isValidRegistered) {
    res.status(401).json({
      error: "invalid_client",
      error_description: "Invalid client_id or client_secret.",
    });
    return true;
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
  return true;
}
