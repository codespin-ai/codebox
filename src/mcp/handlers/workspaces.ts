// src/mcp/handlers/projects.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import {
  getWorkspaces,
  validateWorkspaceName,
} from "../../config/workspaceConfig.js";
import { openProject, closeSession } from "../../workspaceTokens/workspaceTokenStore.js";

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
    "open_project_session",
    "Open a workspace, optionally creating a copy of the project files if the project has copy=true",
    {
      projectName: zod.string().describe("The name of the project to open"),
    },
    async ({ projectName }) => {
      try {
        if (!validateWorkspaceName(projectName)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Invalid or unregistered project: ${projectName}`,
              },
            ],
          };
        }

        const workspaceToken = openProject(projectName);
        if (!workspaceToken) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Could not open project: ${projectName}`,
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
    "close_project_session",
    "Close a project session and clean up resources",
    {
      workspaceToken: zod.string().describe("The workspace token to close"),
    },
    async ({ workspaceToken }) => {
      const closed = closeSession(workspaceToken);

      if (closed) {
        return {
          content: [
            {
              type: "text",
              text: `Session closed: ${workspaceToken}`,
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
