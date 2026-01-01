// HTTP Streaming transport with OAuth 2.1 integration
import type { Request, Response } from "express";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import type * as http from "http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../server.js";
import { authMiddleware } from "../../auth/middleware.js";
import { registerOAuthRoutes } from "../../routes/oauth/index.js";
import { setRegisteredClient, getClientCredentials, loadEnvFile } from "../../auth/index.js";
import { logger } from "../../logging/console-logger.js";

// Session tracking
const transports = new Map<string, StreamableHTTPServerTransport>();
const sessionActivity = new Map<string, number>();

export type HttpTransportOptions = {
  host?: string | undefined;
  port?: number | undefined;
  allowedOrigins?: string[] | undefined;
  idleTimeout?: number | undefined;
  auth?: boolean | undefined;
};

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
  app.use((req, res, next) => {
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
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [sid, lastActivity] of sessionActivity.entries()) {
      if (now - lastActivity > IDLE_TIMEOUT) {
        const transport = transports.get(sid);
        if (transport) {
          logger.info(
            `Closing idle session ${sid} after ${Math.round((now - lastActivity) / 1000 / 60)} minutes of inactivity`
          );
          transport.close();
        }
        sessionActivity.delete(sid);
      }
    }
  }, 60000); // Check every minute

  // Select middleware based on auth setting
  const mcpMiddleware = authEnabled ? [authMiddleware] : [];

  // Handle POST requests for client messages
  app.post("/mcp", ...mcpMiddleware, async (req: Request, res: Response) => {
    logger.debug("Received MCP POST request");
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        const existingTransport = transports.get(sessionId);
        if (!existingTransport) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Session not found" },
            id: req?.body?.id,
          });
          return;
        }
        transport = existingTransport;
        sessionActivity.set(sessionId, Date.now());
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New session initialization
        const server = await createServer();

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            logger.debug(`Session initialized with ID: ${sid}`);
            transports.set(sid, transport);
            sessionActivity.set(sid, Date.now());
          },
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
            sessionActivity.delete(transport.sessionId);
          }
        };

        // Type assertion for SDK compatibility
        await server.connect(transport as Parameters<typeof server.connect>[0]);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: missing or invalid mcp-session-id",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("Error handling MCP POST request", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Handle GET requests for SSE streams
  app.get("/mcp", ...mcpMiddleware, async (req: Request, res: Response) => {
    logger.debug("Received MCP GET request");
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
      return;
    }

    sessionActivity.set(sessionId, Date.now());
    await transport.handleRequest(req, res);
  });

  // Handle DELETE requests for session termination
  app.delete("/mcp", ...mcpMiddleware, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !transports.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session ID provided" },
        id: null,
      });
      return;
    }

    logger.debug(`Session termination request for session ${sessionId}`);

    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Session not found" },
        id: null,
      });
      return;
    }

    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      logger.error("Error handling session termination", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Error handling session termination" },
          id: null,
        });
      }
    }
  });

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
    for (const [sessionId, transport] of transports) {
      try {
        transport.close();
      } catch (_err) {
        // Ignore errors during cleanup
      }
      transports.delete(sessionId);
      sessionActivity.delete(sessionId);
    }
  });

  return server;
}
