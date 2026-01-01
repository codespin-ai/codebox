// OAuth routes aggregator
import type { Router } from "express";
import { registerDiscoveryRoutes } from "./discovery.js";
import { registerRegistrationRoutes } from "./registration.js";
import { registerAuthorizationRoutes } from "./authorization.js";
import { registerTokenRoutes } from "./token.js";

export function registerOAuthRoutes(router: Router): void {
  registerDiscoveryRoutes(router);
  registerRegistrationRoutes(router);
  registerAuthorizationRoutes(router);
  registerTokenRoutes(router);
}
