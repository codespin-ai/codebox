// HTTP Streaming transport with OAuth 2.1 integration
import type { Request, Response, NextFunction } from "express";
import express from "express";
import cors from "cors";
import type * as http from "http";
import { authMiddleware } from "../../../auth/middleware.js";
import { registerOAuthRoutes } from "../../../routes/oauth/index.js";
import { setRegisteredClient, getClientCredentials, loadEnvFile } from "../../../auth/index.js";
import { logger } from "../../../logging/console-logger.js";
import type { HttpTransportOptions } from "./types.js";
import { startIdleSessionCleanup, closeAllSessions } from "./session-manager.js";
import { handleMcpPost, handleMcpGet, handleMcpDelete } from "./mcp-handlers.js";

export type { HttpTransportOptions } from "./types.js";

export async function startHttpTransport(options: HttpTransportOptions = {}): Promise<http.Server> {
  // Load .env file for credentials
  loadEnvFile();

  // Default to localhost only for security
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 13014;
  const allowedOrigins = options.allowedOrigins ?? [`http://localhost:${port}`];
  const IDLE_TIMEOUT = options.idleTimeout ?? 30 * 60 * 1000; // 30 minutes
  const authEnabled = options.auth ?? true;

  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: "*",
      methods: "GET,POST,DELETE",
      preflightContinue: false,
      optionsSuccessStatus: 204,
      exposedHeaders: ["mcp-session-id", "last-event-id", "mcp-protocol-version"],
    })
  );

  // Register static client if credentials are available
  if (authEnabled) {
    const creds = getClientCredentials();
    if (creds) {
      setRegisteredClient(creds.clientId, {
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        redirectUris: ["http://localhost:3000/callback", "http://127.0.0.1:3000/callback"],
        clientName: "Static Admin Client",
        createdAt: Date.now(),
      });
      logger.info(`Pre-registered static client: ${creds.clientId}`);
    } else {
      logger.warn("No CLIENT_ID/CLIENT_SECRET found. OAuth client_credentials flow unavailable.");
      logger.info("You can create credentials with: codebox init");
    }

    // Register OAuth routes
    registerOAuthRoutes(app);
  }

  // Origin validation middleware for non-OAuth routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip origin check for OAuth endpoints
    if (
      req.path.startsWith("/.well-known/") ||
      req.path === "/register" ||
      req.path === "/authorize" ||
      req.path === "/token"
    ) {
      next();
      return;
    }

    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin) && !allowedOrigins.includes("*")) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    next();
  });

  // Set up idle session cleanup
  const cleanupInterval = startIdleSessionCleanup(IDLE_TIMEOUT);

  // Select middleware based on auth setting
  const mcpMiddleware = authEnabled ? [authMiddleware] : [];

  // Handle POST requests for client messages
  app.post("/mcp", ...mcpMiddleware, handleMcpPost);

  // Handle GET requests for SSE streams
  app.get("/mcp", ...mcpMiddleware, handleMcpGet);

  // Handle DELETE requests for session termination
  app.delete("/mcp", ...mcpMiddleware, handleMcpDelete);

  // Start the server
  const server = app.listen(port, host, () => {
    logger.info(`Codebox MCP HTTP server listening at http://${host}:${port}/mcp`);
    if (authEnabled) {
      logger.info("OAuth 2.1 authentication enabled");
    } else {
      logger.info("Authentication disabled (--no-auth)");
    }
  });

  // Handle server shutdown
  server.on("close", () => {
    clearInterval(cleanupInterval);
    closeAllSessions();
  });

  return server;
}
