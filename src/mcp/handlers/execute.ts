// src/mcp/handlers/execute.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { executeDockerCommand } from "../../docker/execution.js";
import {
  getWorkspaceNameForWorkspaceToken,
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register command execution handlers with the MCP server
 */
export function registerExecuteHandlers(server: McpServer): void {
  server.tool(
    "execute_command",
    "Execute a command in a Docker container using a workspace token",
    {
      command: zod.string().describe("The command to execute in the container"),
      workspaceToken: zod
        .string()
        .describe("The workspace token from open_workspace"),
    },
    async ({ command, workspaceToken }) => {
      // Validate the session
      if (!workspaceTokenExists(workspaceToken)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or expired workspace token: ${workspaceToken}`,
            },
          ],
        };
      }

      // Get the workspace name and working directory from the session
      const workspaceName = getWorkspaceNameForWorkspaceToken(workspaceToken);
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);

      if (!workspaceName || !workingDir) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Workspace token mapping not found: ${workspaceToken}`,
            },
          ],
        };
      }

      try {
        const { stdout, stderr } = await executeDockerCommand(
          workspaceName,
          command,
          workingDir
        );
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error executing command: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}
