// OAuth routes aggregator
import type { Router } from "express";
import { registerDiscoveryRoutes } from "./discovery.js";
import { registerRegistrationRoutes } from "./registration.js";
import { registerAuthorizationRoutes } from "./authorization/index.js";
import { registerTokenRoutes } from "./token/index.js";

export function registerOAuthRoutes(router: Router): void {
  registerDiscoveryRoutes(router);
  registerRegistrationRoutes(router);
  registerAuthorizationRoutes(router);
  registerTokenRoutes(router);
}
