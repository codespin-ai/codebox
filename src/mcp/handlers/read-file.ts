// src/mcp/handlers/read-file.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as zod from "zod";
import * as fs from "fs";
import * as path from "path";
import { validateFilePath } from "../../fs/pathValidation.js";
import {
  getWorkingDirForWorkspaceToken,
  workspaceTokenExists,
} from "../../workspaceTokens/workspaceTokenStore.js";
import {
  formatLinesWithNumbers,
  formatResultSummary,
  parseFileToLines,
} from "../../fs/line-utils.js";
import { truncateContent, formatTruncationInfo } from "../../fs/truncation.js";

/**
 * Register read file handlers with the MCP server
 */
export function registerReadFileHandlers(server: McpServer): void {
  // read_file - Read a single file with optional line range and line numbers
  server.tool(
    "read_file",
    "Read the contents of a file in a workspace with optional line range and line numbers",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      filePath: zod.string().describe("Relative path to the file from workspace root"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum response size in KB (required)"),
      fromLine: zod
        .number()
        .int()
        .positive()
        .optional()
        .describe("Start reading from this line number (1-indexed)"),
      toLine: zod
        .number()
        .int()
        .positive()
        .optional()
        .describe("Stop reading at this line number (inclusive)"),
      showLineNumbers: zod
        .boolean()
        .default(true)
        .describe("Whether to show line numbers in output (default: true)"),
    },
    async ({ workspaceToken, filePath, maxResponseSizeKb, fromLine, toLine, showLineNumbers }) => {
      // Validate the workspace token
      if (!workspaceTokenExists(workspaceToken)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
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
              type: "text" as const,
              text: `Error: Workspace token mapping not found: ${workspaceToken}`,
            },
          ],
        };
      }

      // Pre-validate the file path
      if (!validateFilePath(workingDir, filePath)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: Invalid file path: ${filePath} - path traversal attempt detected`,
            },
          ],
        };
      }

      try {
        const fullPath = path.join(workingDir, filePath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: `Error: File not found: ${filePath}`,
              },
            ],
          };
        }

        // Read file content
        const rawContent = fs.readFileSync(fullPath, "utf-8");
        const lines = parseFileToLines(rawContent);

        // Format with line numbers and range
        const lineResult = formatLinesWithNumbers(lines, {
          fromLine,
          toLine,
          showLineNumbers,
        });

        // Add summary
        const summary = formatResultSummary(lineResult);
        let fullContent = lineResult.content + "\n" + summary;

        // Truncate if needed
        const truncResult = truncateContent(fullContent, maxResponseSizeKb);
        fullContent = truncResult.content + formatTruncationInfo(truncResult);

        return {
          content: [
            {
              type: "text" as const,
              text: fullContent,
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error reading file: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );

  // read_batch_files - Read multiple files in a single request
  server.tool(
    "read_batch_files",
    "Read multiple files in a single request with optional line ranges",
    {
      workspaceToken: zod.string().describe("The workspace token from open_workspace"),
      files: zod
        .array(
          zod.object({
            filePath: zod.string().describe("Relative path to the file"),
            fromLine: zod.number().int().positive().optional().describe("Start line number"),
            toLine: zod.number().int().positive().optional().describe("End line number"),
            showLineNumbers: zod.boolean().default(true).describe("Show line numbers"),
          })
        )
        .min(1)
        .describe("Array of files to read"),
      maxResponseSizeKb: zod.number().positive().describe("Maximum total response size in KB"),
      stopOnError: zod
        .boolean()
        .default(false)
        .describe("Stop processing on first error (default: false)"),
    },
    async ({ workspaceToken, files, maxResponseSizeKb, stopOnError }) => {
      // Validate the workspace token
      if (!workspaceTokenExists(workspaceToken)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: Invalid or expired workspace token: ${workspaceToken}`,
            },
          ],
        };
      }

      const workingDir = getWorkingDirForWorkspaceToken(workspaceToken);
      if (!workingDir) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Error: Workspace token mapping not found: ${workspaceToken}`,
            },
          ],
        };
      }

      const results: string[] = [];
      let hasErrors = false;

      for (const file of files) {
        // Validate path
        if (!validateFilePath(workingDir, file.filePath)) {
          const errorMsg = `=== ${file.filePath} ===\nError: Invalid file path - path traversal attempt detected\n`;
          if (stopOnError) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: errorMsg }],
            };
          }
          results.push(errorMsg);
          hasErrors = true;
          continue;
        }

        try {
          const fullPath = path.join(workingDir, file.filePath);

          if (!fs.existsSync(fullPath)) {
            const errorMsg = `=== ${file.filePath} ===\nError: File not found\n`;
            if (stopOnError) {
              return {
                isError: true,
                content: [{ type: "text" as const, text: errorMsg }],
              };
            }
            results.push(errorMsg);
            hasErrors = true;
            continue;
          }

          const rawContent = fs.readFileSync(fullPath, "utf-8");
          const lines = parseFileToLines(rawContent);
          const lineResult = formatLinesWithNumbers(lines, {
            fromLine: file.fromLine,
            toLine: file.toLine,
            showLineNumbers: file.showLineNumbers,
          });

          const summary = formatResultSummary(lineResult);
          results.push(`=== ${file.filePath} ===\n${lineResult.content}\n${summary}\n`);
        } catch (error) {
          const errorMsg = `=== ${file.filePath} ===\nError: ${error instanceof Error ? error.message : "Unknown error"}\n`;
          if (stopOnError) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: errorMsg }],
            };
          }
          results.push(errorMsg);
          hasErrors = true;
        }
      }

      let fullContent = results.join("\n");

      // Truncate if needed
      const truncResult = truncateContent(fullContent, maxResponseSizeKb);
      fullContent = truncResult.content + formatTruncationInfo(truncResult);

      return {
        isError: hasErrors,
        content: [
          {
            type: "text" as const,
            text: fullContent,
          },
        ],
      };
    }
  );
}
