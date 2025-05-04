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
  } = {}
): Promise<http.Server> {
  const host = options.host ?? "0.0.0.0";
  const port = options.port ?? 4000;
  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post("/mcp", async (req: Request, res: Response, _next: NextFunction) => {
    const sessionId = req.header("mcp-session-id");
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
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
    transports[sid].handleRequest(req, res);
  });

  app.delete("/mcp", (req: Request, res: Response, _next: NextFunction) => {
    const sid = req.header("mcp-session-id");
    if (!sid || !transports[sid]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    transports[sid].handleRequest(req, res);
  });

  const server = app.listen(port, host, () => {
    console.error(
      `Codebox MCP HTTP server listening at http://${host}:${port}/mcp`
    );
  });

  return server;
}
