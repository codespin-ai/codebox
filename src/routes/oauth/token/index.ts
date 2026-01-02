// Token routes - barrel file
import type { Router } from "express";
import express from "express";
import { handleAuthorizationCodeGrant } from "./authorization-code.js";
import { handleRefreshTokenGrant } from "./refresh-token.js";
import { handleClientCredentialsGrant } from "./client-credentials.js";
import { logger } from "../../../logging/console-logger.js";

export function registerTokenRoutes(router: Router): void {
  router.post("/token", express.json(), express.urlencoded({ extended: true }), (req, res) => {
    logger.debug(`Token request received: ${JSON.stringify(req.body)}`);
    const grantType = req.body.grant_type as string | undefined;

    if (grantType === "authorization_code") {
      handleAuthorizationCodeGrant(req, res);
      return;
    }
    if (grantType === "refresh_token") {
      handleRefreshTokenGrant(req, res);
      return;
    }
    if (grantType === "client_credentials") {
      handleClientCredentialsGrant(req, res);
      return;
    }

    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Supported grant types: authorization_code, refresh_token, client_credentials",
    });
  });
}
