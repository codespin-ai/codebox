// MCP route handlers for HTTP transport
import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createServer } from "../../server.js";
import { logger } from "../../../logging/console-logger.js";
import {
  getTransport,
  hasSession,
  setTransport,
  deleteSession,
  updateSessionActivity,
} from "./session-manager.js";

export async function handleMcpPost(req: Request, res: Response): Promise<void> {
  logger.debug("Received MCP POST request");
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && hasSession(sessionId)) {
      const existingTransport = getTransport(sessionId);
      if (!existingTransport) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: req?.body?.id,
        });
        return;
      }
      transport = existingTransport;
      updateSessionActivity(sessionId);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      const server = await createServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          logger.debug(`Session initialized with ID: ${sid}`);
          setTransport(sid, transport);
          updateSessionActivity(sid);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          deleteSession(transport.sessionId);
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
}

export async function handleMcpGet(req: Request, res: Response): Promise<void> {
  logger.debug("Received MCP GET request");
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !hasSession(sessionId)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
    return;
  }

  const transport = getTransport(sessionId);
  if (!transport) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Session not found" },
      id: null,
    });
    return;
  }

  updateSessionActivity(sessionId);
  await transport.handleRequest(req, res);
}

export async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !hasSession(sessionId)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
    return;
  }

  logger.debug(`Session termination request for session ${sessionId}`);

  const transport = getTransport(sessionId);
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
}
