// Dynamic Client Registration (RFC 7591)
import type { Router } from "express";
import express from "express";
import { setRegisteredClient } from "../../auth/token-store.js";
import { generateClientCredentials } from "../../auth/pkce.js";
import { logger } from "../../logging/console-logger.js";

export function registerRegistrationRoutes(router: Router): void {
  router.post("/register", express.json(), (req, res) => {
    const { redirect_uris, client_name } = req.body as {
      redirect_uris?: string[];
      client_name?: string;
    };

    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      res.status(400).json({
        error: "invalid_redirect_uri",
        error_description: "At least one redirect_uri is required",
      });
      return;
    }

    const { clientId, clientSecret } = generateClientCredentials();

    setRegisteredClient(clientId, {
      clientId,
      clientSecret,
      redirectUris: redirect_uris,
      clientName: client_name,
      createdAt: Date.now(),
    });

    logger.info(`Registered new client: ${clientId} (${client_name ?? "unnamed"})`);

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris,
      client_name,
    });
  });
}
