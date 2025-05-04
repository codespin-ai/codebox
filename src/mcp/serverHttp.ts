// src/mcp/serverHttp.ts
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "./server.js";
import * as http from "http";

export async function startHttpServer(
  options: {
    host?: string;
    port?: number;
    allowedOrigins?: string[];
    idleTimeout?: number;
  } = {}
): Promise<http.Server> {
  // Default to localhost only for security
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 13014;
  const allowedOrigins = options.allowedOrigins || ["http://localhost:" + port];
  const IDLE_TIMEOUT = options.idleTimeout ?? 30 * 60 * 1000; // 30 minutes in milliseconds

  const app = express();
  app.use(express.json());

  // Fix the middleware type error by not returning a value
  app.use((req, res, next) => {
    // Check origin header for all requests
    const origin = req.headers.origin;
    if (origin) {
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else {
        res.status(403).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Origin not allowed",
          },
          id: null,
        });
        // Don't call next() when sending an error response
        return;
      }
    }

    // Add basic security headers
    res.setHeader("X-Content-Type-Options", "nosniff");

    next();
  });

  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const sessionActivity: Record<string, number> = {};

  // Session scavenging interval
  const scavengerInterval = setInterval(() => {
    const now = Date.now();
    Object.entries(sessionActivity).forEach(([sid, lastActivity]) => {
      if (now - lastActivity > IDLE_TIMEOUT) {
        if (transports[sid]) {
          console.log(
            `Closing idle session ${sid} after ${Math.round(
              (now - lastActivity) / 1000 / 60
            )} minutes of inactivity`
          );
          transports[sid].close();
          // transport.onclose will handle cleanup from transports object
        }
        delete sessionActivity[sid];
      }
    });
  }, 60000); // Check every minute

  app.post("/mcp", async (req: Request, res: Response, _next: NextFunction) => {
    const sessionId = req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
      // Update activity timestamp
      sessionActivity[sessionId] = Date.now();
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
          sessionActivity[sid] = Date.now();
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
          delete sessionActivity[transport.sessionId];
        }
      };

      const server = await createServer();
      await server.connect(transport);
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
  });

  app.get("/mcp", (req: Request, res: Response, _next: NextFunction) => {
    const sid = req.header("mcp-session-id");
    if (!sid || !transports[sid]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    // Update activity timestamp
    sessionActivity[sid] = Date.now();
    transports[sid].handleRequest(req, res);
  });

  app.delete("/mcp", (req: Request, res: Response, _next: NextFunction) => {
    const sid = req.header("mcp-session-id");
    if (!sid || !transports[sid]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    // Update activity timestamp (even for delete operations)
    sessionActivity[sid] = Date.now();
    transports[sid].handleRequest(req, res);
  });

  const server = app.listen(port, host, () => {
    console.error(
      `Codebox MCP HTTP server listening at http://${host}:${port}/mcp`
    );
  });

  // Clean up the interval when the server closes
  server.on("close", () => {
    clearInterval(scavengerInterval);
  });

  return server;
}
