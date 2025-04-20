// src/mcp/handlers/files.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import { writeWorkspaceFile } from "../../fs/fileIO.js";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";

/**
 * Register file operation handlers with the MCP server
 */
export function registerFileHandlers(server: McpServer): void {
  server.tool(
    "write_file",
    "Write content to a file in a workspace directory using a workspace token",
    {
      workspaceToken: zod
        .string()
        .describe("The workspace token from open_workspace"),
      filePath: zod
        .string()
        .describe("Relative path to the file from workspace root"),
      content: zod.string().describe("Content to write to the file"),
      mode: zod
        .enum(["overwrite", "append"])
        .default("overwrite")
        .describe("Write mode - whether to overwrite or append"),
    },
    async ({ workspaceToken, filePath, content, mode }) => {
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

      // Get the working directory from the workspace token
      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);
      if (!workingDir) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Workspace Token mapping not found: ${workspaceToken}`,
            },
          ],
        };
      }

      // Pre-validate the file path before attempting any operations
      if (!validateFilePath(workingDir, filePath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Invalid file path: ${filePath} - path traversal attempt detected`,
            },
          ],
        };
      }

      try {
        // Write file to the workspace token's working directory
        writeWorkspaceFile(workingDir, filePath, content, mode);

        return {
          content: [
            {
              type: "text",
              text: `Successfully ${
                mode === "append" ? "appended to" : "wrote"
              } file: ${filePath}`,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error writing file: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }
  );
}
