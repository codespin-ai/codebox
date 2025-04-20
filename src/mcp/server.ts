// src/mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLoggingEnabledServer } from "./logging.js";

// Import handlers
import { registerFileHandlers } from "./handlers/files.js";
import { registerProjectHandlers } from "./handlers/workspaces.js";
import { registerExecuteHandlers } from "./handlers/execute.js";
import { registerBatchHandlers } from "./handlers/batch.js";
import { registerBatchFileHandlers } from "./handlers/batchFiles.js";

/**
 * Create the MCP server with all handlers registered
 */
export async function createServer(): Promise<McpServer> {
  // Create the base server
  const baseServer = new McpServer(
    {
      name: "codebox",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    }
  );

  // Add logging if enabled in configuration
  const server = createLoggingEnabledServer(baseServer);

  // Register all handlers
  registerFileHandlers(server);
  registerProjectHandlers(server);
  registerExecuteHandlers(server);
  registerBatchHandlers(server);
  registerBatchFileHandlers(server);

  return server;
}

/**
 * Start the MCP server and connect it to stdio
 */
export async function startServer(): Promise<void> {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebox MCP server running. Waiting for commands...");
}