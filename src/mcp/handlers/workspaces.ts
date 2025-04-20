// src/mcp/handlers/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  getWorkspaces,
  validateWorkspaceName,
} from "../../config/workspaceConfig.js";
import { closeWorkspace, openWorkspace } from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register project-related handlers with the MCP server
 */
export function registerProjectHandlers(server: McpServer): void {
  server.tool("list_projects", "List available projects", {}, async () => {
    try {
      const projects = getWorkspaces();

      if (projects.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No projects are registered. Use 'codebox project add <dirname> --image <image_name>' to add projects.",
            },
          ],
        };
      }

      // Extract only project names for output
      const projectNames = projects.map((project) => project.name);

      return {
        content: [
          {
            type: "text",
            text: projectNames.join("\n"),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing projects: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
        ],
      };
    }
  });

  server.tool(
    "open_workspace",
    "Open a workspace, optionally creating a copy of the project files if the project has copy=true",
    {
      workspaceName: zod.string().describe("The name of the project to open"),
    },
    async ({ workspaceName }) => {
      try {
        if (!validateWorkspaceName(workspaceName)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Invalid or unregistered project: ${workspaceName}`,
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
                text: `Error: Could not open project: ${workspaceName}`,
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
              text: `Error opening project: ${
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
