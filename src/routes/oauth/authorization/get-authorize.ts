// GET /authorize handler - Shows consent screen

import type { Request, Response } from "express";
import {
  getRegisteredClient,
  setPendingAuthorization,
  PENDING_AUTH_EXPIRATION_MS,
} from "../../../auth/token-store.js";
import { generateCsrfToken } from "../../../auth/pkce.js";
import { generateConsentHtml } from "./consent-page.js";

export function handleGetAuthorize(req: Request, res: Response): void {
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } =
    req.query as Record<string, string>;

  // Validate required parameters
  if (response_type !== "code") {
    res.status(400).send("Invalid response_type. Only 'code' is supported.");
    return;
  }

  if (!client_id) {
    res.status(400).send("Missing client_id");
    return;
  }

  // Check if client is registered
  const client = getRegisteredClient(client_id);
  if (!client) {
    res.status(400).send(`Unknown client_id: ${client_id}`);
    return;
  }

  if (!redirect_uri) {
    res.status(400).send("Missing redirect_uri");
    return;
  }

  // Validate redirect_uri against registered URIs (with wildcard support)
  const isValidRedirect = client.redirectUris.some((uri) => {
    if (uri.includes("*")) {
      const pattern = uri.replace(/\*/g, ".*");
      return new RegExp(`^${pattern}$`).test(redirect_uri);
    }
    return uri === redirect_uri;
  });

  if (!isValidRedirect) {
    res.status(400).send(`Invalid redirect_uri: ${redirect_uri}`);
    return;
  }

  if (!code_challenge || !code_challenge_method) {
    res.status(400).send("PKCE required: missing code_challenge or code_challenge_method");
    return;
  }

  if (code_challenge_method !== "S256") {
    res.status(400).send("Only S256 code_challenge_method is supported");
    return;
  }

  // Generate CSRF token and store pending authorization
  const csrfToken = generateCsrfToken();
  setPendingAuthorization(csrfToken, {
    clientId: client_id,
    redirectUri: redirect_uri,
    state: state || undefined,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method,
    expiresAt: Date.now() + PENDING_AUTH_EXPIRATION_MS,
  });

  // Show consent screen
  const clientName = client.clientName ?? client_id;
  const html = generateConsentHtml(clientName, csrfToken);
  res.type("html").send(html);
}
