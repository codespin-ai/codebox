// src/mcp/logging.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logMcpCall } from "../logging/logger.js";
import { ZodRawShape } from "zod";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { isDebugEnabled } from "../config/workspaceConfig.js";
import {
  ServerNotification,
  ServerRequest,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";

// Define the expected tool handler signature
type ToolCallback = (
  args: Record<string, unknown>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<{
  content: (
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "audio"; data: string; mimeType: string }
    | { type: "resource"; resource: { uri: string; blob: string } }
  )[];
  _meta?: Record<string, unknown>;
  isError?: boolean;
}>;

// Wraps a tool handler with logging
export function wrapToolHandler(
  name: string,
  handler: ToolCallback
): ToolCallback {
  return async (args, extra) => {
    const startTime = new Date();
    let response: Awaited<ReturnType<ToolCallback>> | undefined = undefined;
    let error: unknown = null;

    try {
      response = await handler(args, extra);
      return response;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const endTime = new Date();

      logMcpCall({
        method: name,
        payload: args,
        response: error ? { error: String(error) } : response,
        startTime,
        endTime,
      });
    }
  };
}

export function addLoggingToServer(server: McpServer): McpServer {
  const originalTool = server.tool.bind(server);

  server.tool = function (...args: unknown[]) {
    const name = args[0] as string;
    const callbackIndex = args.length - 1;
    const callback = args[callbackIndex] as ToolCallback;

    if (typeof callback === "function") {
      args[callbackIndex] = wrapToolHandler(name, callback);
    }

    return originalTool.apply(
      server,
      args as [string, string, ZodRawShape, ToolAnnotations, ToolCallback]
    );
  };

  return server;
}

export function createLoggingEnabledServer(server: McpServer): McpServer {
  // If debug mode is enabled, add logging
  return isDebugEnabled() ? addLoggingToServer(server) : server;
}
