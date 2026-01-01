// Authorization Endpoint with PKCE and CSRF protection
import type { Router } from "express";
import express from "express";
import {
  getRegisteredClient,
  setPendingAuthorization,
  getPendingAuthorization,
  deletePendingAuthorization,
  setAuthorizationCode,
  PENDING_AUTH_EXPIRATION_MS,
  AUTH_CODE_EXPIRATION_MS,
} from "../../auth/token-store.js";
import { generateCsrfToken, generateAuthorizationCode } from "../../auth/pkce.js";
import { logger } from "../../logging/console-logger.js";

// Generate consent screen HTML
function generateConsentHtml(clientName: string, csrfToken: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize Access - Codebox</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 40px;
      max-width: 420px;
      width: 100%;
    }
    h1 {
      color: #1a202c;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #718096;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .client-info {
      background: #f7fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-name {
      font-weight: 600;
      color: #2d3748;
      font-size: 16px;
    }
    .permissions {
      margin-bottom: 24px;
    }
    .permissions h3 {
      color: #4a5568;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .permission-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      color: #4a5568;
      font-size: 14px;
    }
    .permission-item::before {
      content: "ok";
      color: #48bb78;
      font-weight: bold;
      margin-right: 10px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    button {
      flex: 1;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .allow {
      background: #667eea;
      color: white;
      border: none;
    }
    .allow:hover { background: #5a67d8; }
    .deny {
      background: white;
      color: #4a5568;
      border: 1px solid #e2e8f0;
    }
    .deny:hover { background: #f7fafc; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Authorize Access</h1>
    <p class="subtitle">An application is requesting access to execute commands</p>

    <div class="client-info">
      <div class="client-name">${clientName}</div>
    </div>

    <div class="permissions">
      <h3>This application will be able to:</h3>
      <div class="permission-item">Execute commands in Docker containers</div>
      <div class="permission-item">Read and write files in workspaces</div>
      <div class="permission-item">List and manage workspaces</div>
    </div>

    <form method="POST" action="/authorize" style="margin-top: 24px;">
      <input type="hidden" name="csrf_token" value="${csrfToken}">
      <div class="buttons">
        <button type="submit" name="action" value="deny" class="deny">Deny</button>
        <button type="submit" name="action" value="allow" class="allow">Allow</button>
      </div>
    </form>
  </div>
</body>
</html>`;
}

export function registerAuthorizationRoutes(router: Router): void {
  // GET /authorize - Shows consent screen
  router.get("/authorize", (req, res) => {
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
  });

  // POST /authorize - Handle consent form submission
  router.post("/authorize", express.urlencoded({ extended: true }), (req, res) => {
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
  });
}
