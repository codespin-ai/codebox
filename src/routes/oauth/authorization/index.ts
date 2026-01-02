// Authorization routes - barrel file

import type { Router } from "express";
import express from "express";
import { handleGetAuthorize } from "./get-authorize.js";
import { handlePostAuthorize } from "./post-authorize.js";

export function registerAuthorizationRoutes(router: Router): void {
  router.get("/authorize", handleGetAuthorize);
  router.post("/authorize", express.urlencoded({ extended: true }), handlePostAuthorize);
}

export { generateConsentHtml } from "./consent-page.js";
