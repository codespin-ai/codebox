// src/mcp/handlers/workspaces.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  getWorkspaces,
  validateWorkspaceName,
} from "../../config/workspaceConfig.js";
import { closeWorkspace, openWorkspace } from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register workspace-related handlers with the MCP server
 */
export function registerWorkspaceHandlers(server: McpServer): void {
  server.tool("list_workspaces", "List available workspaces", {}, async () => {
    try {
      const workspaces = getWorkspaces();

      if (workspaces.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No workspaces are registered. Use 'codebox workspace add <dirname> --image <image_name>' to add workspaces.",
            },
          ],
        };
      }

      // Extract only workspace names for output
      const workspaceNames = workspaces.map((workspace) => workspace.name);

      return {
        content: [
          {
            type: "text",
            text: workspaceNames.join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing workspaces: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  });

  server.tool(
    "open_workspace",
    "Open a workspace, optionally creating a copy of the workspace files if the workspace has copy=true",
    {
      workspaceName: zod.string().describe("The name of the workspace to open"),
    },
    async ({ workspaceName }) => {
      try {
        if (!validateWorkspaceName(workspaceName)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Invalid or unregistered workspace: ${workspaceName}`,
              },
            ],
          };
        }

        const workspaceToken = openWorkspace(workspaceName);
        if (!workspaceToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Could not open workspace: ${workspaceName}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: workspaceToken,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error opening workspace: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "close_workspace",
    "Close a workspace and clean up resources",
    {
      workspaceToken: zod.string().describe("The workspace token to close"),
    },
    async ({ workspaceToken }) => {
      const closed = closeWorkspace(workspaceToken);

      if (closed) {
        return {
          content: [
            {
              type: "text",
              text: `Workspace token closed: ${workspaceToken}`,
            },
          ],
        };
      } else {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid workspace token: ${workspaceToken}`,
            },
          ],
        };
      }
    }
  );
}
