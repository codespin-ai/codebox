// src/mcp/handlers/batch.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { executeDockerCommand } from "../../docker/execution.js";
import {
  getWorkspaceNameForWorkspaceToken,
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register batch command execution handlers with the MCP server
 */
export function registerBatchHandlers(server: McpServer): void {
  server.tool(
    "execute_batch_commands",
    "Execute multiple commands in sequence using a workspace token",
    {
      commands: zod
        .array(zod.string())
        .describe("Array of commands to execute in sequence"),
      workspaceToken: zod
        .string()
        .describe("The workspace token from open_workspace"),
      stopOnError: zod
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to stop execution if a command fails"),
    },
    async ({ commands, workspaceToken, stopOnError }) => {
      // Validate the workspace token
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

      // Get the workspace name and working directory from the workspace token
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

      const results = [];

      for (const command of commands) {
        try {
          const { stdout, stderr } = await executeDockerCommand(
            workspaceName,
            command,
            workingDir
          );
          const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : "");

          // Add the command and its output to results
          results.push({
            command,
            output,
            success: true,
          });
        } catch (error) {
          results.push({
            command,
            output: error instanceof Error ? error.message : "Unknown error",
            success: false,
          });

          // Stop if stopOnError is true
          if (stopOnError) {
            break;
          }
        }
      }

      // Format the results
      const formattedResults = results
        .map((result) => {
          return (
            `Command: ${result.command}\n` +
            `Status: ${result.success ? "Success" : "Failed"}\n` +
            `Output:\n${result.output}\n` +
            "----------------------------------------\n"
          );
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: formattedResults,
          },
        ],
      };
    }
  );
}
