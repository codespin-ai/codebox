// POST /authorize handler - Handle consent form submission

import type { Request, Response } from "express";
import {
  getPendingAuthorization,
  deletePendingAuthorization,
  setAuthorizationCode,
  AUTH_CODE_EXPIRATION_MS,
} from "../../../auth/token-store.js";
import { generateAuthorizationCode } from "../../../auth/pkce.js";
import { logger } from "../../../logging/console-logger.js";

export function handlePostAuthorize(req: Request, res: Response): void {
  const { csrf_token, action } = req.body as { csrf_token?: string; action?: string };

  // Verify CSRF token - this proves the user saw our consent screen
  if (!csrf_token || typeof csrf_token !== "string") {
    res.status(400).send("Invalid request: missing CSRF token");
    return;
  }

  const pendingAuth = getPendingAuthorization(csrf_token);
  if (!pendingAuth) {
    res.status(400).send("Invalid or expired authorization request. Please try again.");
    return;
  }

  // Delete the pending auth immediately (one-time use)
  deletePendingAuthorization(csrf_token);

  // Check expiration
  if (Date.now() > pendingAuth.expiresAt) {
    res.status(400).send("Authorization request expired. Please try again.");
    return;
  }

  // Build redirect URL
  const redirectUrl = new URL(pendingAuth.redirectUri);

  if (action !== "allow") {
    // User denied access
    redirectUrl.searchParams.set("error", "access_denied");
    redirectUrl.searchParams.set("error_description", "User denied the authorization request");
    if (pendingAuth.state) redirectUrl.searchParams.set("state", pendingAuth.state);
    res.redirect(redirectUrl.toString());
    return;
  }

  // User approved - generate authorization code
  const code = generateAuthorizationCode();

  setAuthorizationCode(code, {
    clientId: pendingAuth.clientId,
    redirectUri: pendingAuth.redirectUri,
    codeChallenge: pendingAuth.codeChallenge,
    codeChallengeMethod: pendingAuth.codeChallengeMethod,
    expiresAt: Date.now() + AUTH_CODE_EXPIRATION_MS,
  });

  logger.info(`Authorization code issued for client: ${pendingAuth.clientId}`);

  redirectUrl.searchParams.set("code", code);
  if (pendingAuth.state) redirectUrl.searchParams.set("state", pendingAuth.state);

  const redirectTarget = redirectUrl.toString();
  logger.debug(`Redirecting to: ${redirectTarget}`);
  res.redirect(redirectTarget);
}
