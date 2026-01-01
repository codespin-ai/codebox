// OAuth 2.1 Discovery Endpoints (RFC 9728, RFC 8414)
import type { Router } from "express";
import { getServerUrl } from "../../auth/middleware.js";

export function registerDiscoveryRoutes(router: Router): void {
  // Protected Resource Metadata (RFC 9728)
  router.get("/.well-known/oauth-protected-resource", (req, res) => {
    const serverUrl = getServerUrl(req);
    res.json({
      resource: serverUrl,
      authorization_servers: [serverUrl],
      bearer_methods_supported: ["header"],
    });
  });

  // Authorization Server Metadata (RFC 8414)
  router.get("/.well-known/oauth-authorization-server", (req, res) => {
    const serverUrl = getServerUrl(req);
    res.json({
      issuer: serverUrl,
      authorization_endpoint: `${serverUrl}/authorize`,
      token_endpoint: `${serverUrl}/token`,
      registration_endpoint: `${serverUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      code_challenge_methods_supported: ["S256"],
      service_documentation: "https://github.com/codespin-ai/codebox",
    });
  });
}
