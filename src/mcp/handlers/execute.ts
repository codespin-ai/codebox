// src/mcp/handlers/execute.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { executeDockerCommand } from "../../docker/execution.js";
import {
  getProjectNameForSession,
  getWorkingDirForSession,
  sessionExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register command execution handlers with the MCP server
 */
export function registerExecuteHandlers(server: McpServer): void {
  server.tool(
    "execute_command",
    "Execute a command in a Docker container using a project session",
    {
      command: zod.string().describe("The command to execute in the container"),
      workspaceToken: zod
        .string()
        .describe("The session ID from open_project_session"),
    },
    async ({ command, workspaceToken }) => {
      // Validate the session
      if (!sessionExists(workspaceToken)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid or expired session ID: ${workspaceToken}`,
            },
          ],
        };
      }

      // Get the workspace name and working directory from the session
      const projectName = getProjectNameForSession(workspaceToken);
      const workingDir = getWorkingDirForSession(workspaceToken);

      if (!projectName || !workingDir) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Session mapping not found: ${workspaceToken}`,
            },
          ],
        };
      }

      try {
        const { stdout, stderr } = await executeDockerCommand(
          projectName,
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
