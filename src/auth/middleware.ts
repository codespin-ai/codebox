// Express authentication middleware
import type { Request, Response, NextFunction } from "express";
import { validateAccessToken } from "./token-store.js";

// Auth middleware for protecting routes
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "unauthorized",
      error_description: "Missing or invalid Authorization header. Use Bearer token.",
    });
    return;
  }

  const token = authHeader.substring(7);
  if (!validateAccessToken(token)) {
    res.status(401).json({
      error: "invalid_token",
      error_description: "Access token is invalid or expired.",
    });
    return;
  }

  next();
}

// Get server URL from request (handles proxies)
export function getServerUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${protocol}://${host}`;
}
